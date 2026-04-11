import asyncio
import time
import random
import re
import discord
import typing
from main.lib.db import (
    get_autoreacts, get_autoreplies, get_relation, update_relation,
    get_guild_prefix, get_guild_user_prefix, get_chat_enabled,
    get_user_autoreacts, get_user_autoreplies,
    get_conversation_history, get_conversation_summary_record,
    save_conversation_turn, get_messages_to_summarize, save_conversation_summary,
    delete_messages_by_ids, clear_conversation_history,
    add_xp, set_level_in_db, get_level_channel, get_level_role_for_level,
    get_lilith_mood_data,
)
from main.lib.constants import OWNER_ID, BOT_MULTIPLIER, AFFINITY_TABLE, DRUG_RESPONSES
from main.lib.ai import (
    ask_lilith, compute_mode, summarize_conversation, generate_tts,
    set_owner_bypass_suspended, get_owner_bypass_suspended, assess_mental_state_delta,
)
from main.lib.automod import run_automod
from main.lib.xp import random_xp, is_on_cooldown, compute_level

_recently_processed: set = set()
_user_message_timestamps: dict = {}


def _track_and_check_spam(guild_id: str, user_id: str) -> int:
    key = f"{guild_id}:{user_id}"
    now = time.time() * 1000
    timestamps = _user_message_timestamps.get(key, [])
    recent = [t for t in timestamps if now - t < 30_000]
    recent.append(now)
    _user_message_timestamps[key] = recent
    if len(recent) >= 6:
        return 8
    if len(recent) >= 4:
        return 4
    return 0


async def _get_wavelink_player(bot: discord.Bot, guild_id: int):
    """Get the wavelink player for a guild if it exists."""
    try:
        import wavelink
        return typing.cast(wavelink.Player, bot.get_guild(guild_id).voice_client)
    except Exception:
        return None


async def handle_message_create(message: discord.Message, bot: discord.Bot):
    if message.id in _recently_processed:
        return
    _recently_processed.add(message.id)
    asyncio.get_event_loop().call_later(10, lambda: _recently_processed.discard(message.id))

    # ── DM handler (owner only) ───────────────────────────────────────────────
    if not message.guild:
        if message.author.bot:
            return
        if str(message.author.id) != OWNER_ID:
            return

        raw = message.content.strip()
        if not raw:
            return

        if raw.startswith("+"):
            without_prefix = raw[1:].strip()
            parts = without_prefix.split()
            cmd = parts[0].lower() if parts else ""
            args = " ".join(parts[1:])

            if cmd == "testmode":
                action = args.lower()
                if action == "on":
                    set_owner_bypass_suspended(True)
                    await message.reply("Test mode **ON**. Owner bypass suspended.")
                    return
                if action == "off":
                    set_owner_bypass_suspended(False)
                    await message.reply("Test mode **OFF**. Owner bypass restored.")
                    return
                current = get_owner_bypass_suspended()
                await message.reply(f"Test mode is currently **{'ON' if current else 'OFF'}**. Usage: `+testmode on` / `+testmode off`")
                return

            if cmd == "tts":
                if not args:
                    await message.reply("Usage: `+tts <text>`")
                    return
                try:
                    import io
                    async with message.channel.typing():
                        buf = await generate_tts(args)
                        file = discord.File(io.BytesIO(buf), filename="lilith_tts.mp3")
                        await message.reply(content=f'🎙️ *"{args}"*', file=file)
                except Exception:
                    await message.reply("TTS failed.")
                return

            if cmd == "mood":
                MOODS = [
                    {"min": 0,  "max": 15,  "mood": "Murderous",            "emoji": "🩸", "color": 0x8b0000},
                    {"min": 16, "max": 30,  "mood": "Seething",             "emoji": "🔥", "color": 0xff0000},
                    {"min": 31, "max": 45,  "mood": "Irritated",            "emoji": "😤", "color": 0xff4500},
                    {"min": 46, "max": 60,  "mood": "Indifferent",          "emoji": "😑", "color": 0x4a4a4a},
                    {"min": 61, "max": 75,  "mood": "Amused",               "emoji": "😏", "color": 0x9932cc},
                    {"min": 76, "max": 90,  "mood": "Dangerously Good",     "emoji": "😈", "color": 0x6a0dad},
                    {"min": 91, "max": 100, "mood": "Suspiciously Pleasant","emoji": "🖤", "color": 0x2a0050},
                ]
                import math
                data = await get_lilith_mood_data()
                avg_annoyance = data["avgAnnoyance"]
                enemy_count = data["enemyCount"]
                hour = discord.utils.utcnow().hour
                time_factor = round(math.sin((hour / 24) * math.pi * 2) * 8)
                score = max(0, min(100, 100 - avg_annoyance - enemy_count * 8 + time_factor))
                entry = next((m for m in MOODS if m["min"] <= score <= m["max"]), MOODS[3])
                bar = "🟪" * round(score / 10) + "⬛" * (10 - round(score / 10))
                embed = discord.Embed(
                    title=f"{entry['emoji']} Lilith's Current Mood",
                    color=entry["color"],
                    description=f"**{entry['mood']}**\n\n{bar}\n\nMood Index: **{score}/100**",
                )
                embed.add_field(name="Avg. Annoyance", value=f"{avg_annoyance}/100", inline=True)
                embed.add_field(name="Active Enemies", value=str(enemy_count), inline=True)
                embed.add_field(name="Users Tracked", value=str(data["userCount"]), inline=True)
                await message.reply(embeds=[embed])
                return

            for drug_cmd in ["hitsmeth", "hitsweed", "chugsdrink", "popspill"]:
                if cmd == drug_cmd:
                    line = random.choice(DRUG_RESPONSES[drug_cmd])
                    display_name = message.author.display_name or message.author.name
                    await message.channel.send(line.replace("{user}", f"**{display_name}**"))
                    return

            if cmd == "clear":
                await clear_conversation_history("GLOBAL", OWNER_ID)
                await message.reply("Memory wiped. Fresh start.")
                return

            if cmd == "help":
                await message.reply(
                    "**DM commands (+ prefix)**\n"
                    "`+mood` — current mood index\n"
                    "`+testmode on/off` — suspend owner bypass\n"
                    "`+tts <text>` — hear my voice\n"
                    "`+clear` — wipe conversation memory\n"
                    "`+hitsmeth` `+hitsweed` `+chugsdrink` `+popspill`\n\n"
                    "Anything else — I'll respond."
                )
                return

            await message.reply("Unknown command. Try `+help`.")
            return

        # No prefix — AI responds
        try:
            import io
            async with message.channel.typing():
                history, summary_record = await asyncio.gather(
                    get_conversation_history("GLOBAL", OWNER_ID),
                    get_conversation_summary_record("GLOBAL", OWNER_ID),
                )
                raw_response = await ask_lilith(raw, {
                    "userId": OWNER_ID,
                    "username": message.author.name,
                    "affinity": 100,
                    "annoyance": 0,
                    "isOwner": True,
                    "history": history,
                    "memorySummary": summary_record["summary"] if summary_record else None,
                })
            response = raw_response.strip() or "..."
            await message.reply(response[:1999])

            # FIX: moved ERROR_FALLBACKS and the save/summarize block inside try
            ERROR_FALLBACKS = ["My mind is elsewhere. Try again.", "..."]
            if response not in ERROR_FALLBACKS:
                await save_conversation_turn("GLOBAL", OWNER_ID, raw, response)

                async def _summarize():
                    try:
                        to_summarize = await get_messages_to_summarize("GLOBAL", OWNER_ID)
                        if not to_summarize:
                            return
                        existing = summary_record["summary"] if summary_record else None
                        new_summary = await summarize_conversation(existing, to_summarize)
                        total_covered = (summary_record.get("messages_covered", 0) if summary_record else 0) + len(to_summarize)
                        await save_conversation_summary("GLOBAL", OWNER_ID, new_summary, total_covered)
                        await delete_messages_by_ids([m["id"] for m in to_summarize])
                    except Exception:
                        pass

                asyncio.create_task(_summarize())
        except Exception as err:
            print(f"[DM handler] {err}")
            try:
                await message.reply("Something broke on my end. Try again.")
            except Exception:
                pass
        return

    # ── Guild message handler ─────────────────────────────────────────────────

    asyncio.create_task(run_automod(message))

    # XP
    if not message.author.bot and not is_on_cooldown(str(message.guild.id), str(message.author.id)):
        async def _xp_task():
            try:
                xp_gain = random_xp()
                result = await add_xp(str(message.guild.id), str(message.author.id), xp_gain)
                new_xp = result["newXp"]
                old_level = result["oldLevel"]
                level_data = compute_level(new_xp)
                new_level = level_data["level"]
                if new_level > old_level:
                    await set_level_in_db(str(message.guild.id), str(message.author.id), new_level)
                    role_id = await get_level_role_for_level(str(message.guild.id), new_level)
                    if role_id:
                        member = message.guild.get_member(message.author.id)
                        if member:
                            role = message.guild.get_role(int(role_id))
                            if role:
                                try:
                                    await member.add_roles(role)
                                except Exception:
                                    pass
                    level_channel_id = await get_level_channel(str(message.guild.id))
                    announce_channel = message.guild.get_channel(int(level_channel_id)) if level_channel_id else message.channel
                    if announce_channel:
                        role_str = f" You've been given <@&{role_id}>." if role_id else ""
                        embed = discord.Embed(
                            description=f"🎉 <@{message.author.id}> leveled up to **Level {new_level}**!{role_str}",
                            color=0xf1c40f,
                        )
                        try:
                            await announce_channel.send(embeds=[embed])
                        except Exception:
                            pass
            except Exception:
                pass
        asyncio.create_task(_xp_task())

    # Bot messages — only process autoreacts/autoreplies
    if message.author.bot:
        if message.author.id == bot.user.id:
            return
        content_lower = message.content.lower()
        reacts = await get_autoreacts(str(message.guild.id))
        replies = await get_autoreplies(str(message.guild.id))
        triggered = False
        for react in reacts:
            if react["trigger"] in content_lower:
                try:
                    await message.add_reaction(react["emoji"])
                except Exception:
                    pass
                triggered = True
        for reply in replies:
            if reply["trigger"] in content_lower:
                await message.reply(reply["reply"])
                triggered = True
                break
        if triggered:
            await update_relation(str(message.author.id), {"annoyance": 1 * BOT_MULTIPLIER})
        return

    user_id = str(message.author.id)
    content = message.content
    content_lower = content.lower()

    # Spam + disrespect tracking
    if user_id != OWNER_ID:
        async def _track_spam():
            try:
                spam_delta = _track_and_check_spam(str(message.guild.id), user_id)
                if spam_delta > 0:
                    await update_relation(user_id, {"annoyance": spam_delta})
                owner_terms = ["tweakbrazy", "king tweak"]
                disrespect_terms = ["fuck", "shit", "bitch", "idiot", "stupid", "trash", "hate", "kill", "shut up", "stfu", "loser", "ugly"]
                if any(t in content_lower for t in owner_terms) and any(t in content_lower for t in disrespect_terms):
                    await update_relation(user_id, {"annoyance": 15})
            except Exception:
                pass
        asyncio.create_task(_track_spam())

    reacts, replies, guild_prefix, user_prefix, user_emojis, user_replies = await asyncio.gather(
        get_autoreacts(str(message.guild.id)),
        get_autoreplies(str(message.guild.id)),
        get_guild_prefix(str(message.guild.id)),
        get_guild_user_prefix(str(message.guild.id), user_id),
        get_user_autoreacts(str(message.guild.id), user_id),
        get_user_autoreplies(str(message.guild.id), user_id),
    )

    effective_prefix = user_prefix or guild_prefix

    for react in reacts:
        if react["trigger"] in content_lower:
            try:
                await message.add_reaction(react["emoji"])
            except Exception:
                pass

    for emoji in user_emojis:
        try:
            await message.add_reaction(emoji)
        except Exception:
            pass

    # Owner reactions
    if user_id == OWNER_ID:
        owner_reacts = ["😈", "🩸", "🖤", "👁️", "🔱", "⛧", "💀", "🕷️", "🌑", "🦇"]
        try:
            await message.add_reaction(random.choice(owner_reacts))
        except Exception:
            pass

    # Owner anger detection — retaliate against whoever they're mad at
    if user_id == OWNER_ID:
        ANGER_TRIGGERS = [
            r'\bstfu\b', r'\bshut up\b', r'\bfuck (you|off|him|her|them)\b',
            r'\bidiot\b', r'\bstupid\b', r'\bmoron\b', r'\bclown\b', r'\bdumbass\b',
            r'\bare you (serious|kidding|dumb|stupid|blind)\b',
            r"\bdon'?t (talk|message|ping|dm) me\b", r'\bleave me alone\b',
            r'\bpiss(ed|ing) me off\b', r'\bkys\b', r'\bscrew (you|off)\b',
        ]
        if any(re.search(p, content, re.IGNORECASE) for p in ANGER_TRIGGERS):
            async def _retaliate():
                try:
                    target_name = None
                    target_id = None
                    if message.reference and message.reference.message_id:
                        try:
                            ref = await message.channel.fetch_message(message.reference.message_id)
                            if ref and str(ref.author.id) != OWNER_ID and not ref.author.bot:
                                target_name = ref.author.name
                                target_id = str(ref.author.id)
                        except Exception:
                            pass
                    if not target_name:
                        for mentioned in message.mentions:
                            if str(mentioned.id) != OWNER_ID and not mentioned.bot:
                                target_name = mentioned.name
                                target_id = str(mentioned.id)
                                break
                    if not target_name or not target_id:
                        return
                    clean = re.sub(r'<@!?\d+>', '', content).strip()
                    roast_prompt = f'tweakbrazy just said "{clean}" — they\'re clearly pissed at {target_name}. Back your owner up. Tear {target_name} apart. Vicious, personal, no mercy.'
                    async with message.channel.typing():
                        roast = await ask_lilith(roast_prompt, {
                            "userId": target_id,
                            "username": target_name,
                            "affinity": -100,
                            "annoyance": 100,
                            "isOwner": False,
                            "enemy": False,
                            "mode": "chat",
                        })
                        await message.channel.send(roast)
                except Exception:
                    pass
            asyncio.create_task(_retaliate())

    for text in user_replies:
        try:
            await message.reply(text)
        except Exception:
            pass

    for reply in replies:
        if reply["trigger"] in content_lower:
            await message.reply(reply["reply"])
            break

    # ── Mention / reply to Lilith ─────────────────────────────────────────────
    is_mentioned = bot.user in message.mentions
    is_reply_to_lilith = False
    if message.reference and message.reference.message_id:
        try:
            ref_msg = await message.channel.fetch_message(message.reference.message_id)
            if ref_msg and ref_msg.author.id == bot.user.id:
                is_reply_to_lilith = True
        except Exception:
            pass

    if is_mentioned or is_reply_to_lilith:
        is_owner = user_id == OWNER_ID
        rel = {"affinity": 100, "annoyance": 0, "enemy": False} if is_owner else await get_relation(user_id, message.author.name)
        query = re.sub(r'<@!?\d+>', '', content).strip() or "..."

        try:
            async with message.channel.typing():
                memory_key = "GLOBAL" if is_owner else str(message.guild.id)
                history, summary_record = await asyncio.gather(
                    get_conversation_history(memory_key, user_id),
                    get_conversation_summary_record(memory_key, user_id),
                )
                response = await ask_lilith(query, {
                    "userId": user_id,
                    "username": message.author.name,
                    "affinity": rel["affinity"],
                    "annoyance": rel["annoyance"],
                    "isOwner": is_owner,
                    "mode": "chat",
                    "enemy": rel.get("enemy", False),
                    "history": history,
                    "memorySummary": summary_record["summary"] if summary_record else None,
                })
            await message.reply(response)
            await save_conversation_turn(memory_key, user_id, query, response)

            async def _compress():
                try:
                    to_summarize = await get_messages_to_summarize(memory_key, user_id)
                    if not to_summarize:
                        return
                    existing = summary_record["summary"] if summary_record else None
                    new_summary = await summarize_conversation(existing, to_summarize)
                    total_covered = (summary_record.get("messages_covered", 0) if summary_record else 0) + len(to_summarize)
                    await save_conversation_summary(memory_key, user_id, new_summary, total_covered)
                    await delete_messages_by_ids([m["id"] for m in to_summarize])
                except Exception:
                    pass
            asyncio.create_task(_compress())
        except Exception:
            pass

        if not is_owner:
            await update_relation(user_id, {"affinity": AFFINITY_TABLE["mention"]})
            async def _mental_delta():
                try:
                    delta = await assess_mental_state_delta(query)
                    if delta > 0:
                        await update_relation(user_id, {"annoyance": delta})
                except Exception:
                    pass
            asyncio.create_task(_mental_delta())
