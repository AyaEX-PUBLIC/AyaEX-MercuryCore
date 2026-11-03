// Emoji for the shoutbox picker and :shortcode: replacement. They're shown
// with the system's emoji font, so only emoji from Unicode 13 or earlier are
// listed, which nearly every device can draw. Each entry is the emoji followed
// by its shortcode names.

const data: [string, string][] = [
	[
		"Smileys",
		"😀 grinning|😃 smiley|😄 smile|😁 grin|😆 laughing|😅 sweat_smile|🤣 rofl|😂 joy|🙂 slight_smile|🙃 upside_down|😉 wink|😊 blush|😇 innocent|🥰 smiling_face_with_hearts|😍 heart_eyes|🤩 star_struck|😘 kissing_heart|😋 yum|😛 stuck_out_tongue|😜 stuck_out_tongue_winking_eye|🤪 zany_face|😝 stuck_out_tongue_closed_eyes|🤑 money_mouth|🤗 hugging|🤭 hand_over_mouth|🤫 shushing_face|🤔 thinking|🤐 zipper_mouth|🤨 raised_eyebrow|😐 neutral_face|😑 expressionless|😶 no_mouth|😏 smirk|😒 unamused|🙄 rolling_eyes|😬 grimacing|😌 relieved|😔 pensive|😪 sleepy|😴 sleeping|😷 mask|🤒 thermometer_face|🤢 nauseated_face|🤮 vomiting|🥵 hot_face|🥶 cold_face|🥴 woozy_face|😵 dizzy_face|🤯 exploding_head|🤠 cowboy|🥳 partying_face|😎 sunglasses|🤓 nerd|🧐 monocle|😕 confused|😟 worried|🙁 slight_frown|😮 open_mouth|😯 hushed|😲 astonished|😳 flushed|🥺 pleading_face|😦 frowning|😧 anguished|😨 fearful|😰 cold_sweat|😥 disappointed_relieved|😢 cry|😭 sob|😱 scream|😖 confounded|😣 persevere|😞 disappointed|😓 sweat|😩 weary|😫 tired_face|🥱 yawning_face|😤 triumph|😠 angry|😡 rage|😈 smiling_imp|👿 imp|💀 skull|☠️ skull_crossbones|💩 poop|🤡 clown|👻 ghost|👽 alien|👾 space_invader|🤖 robot|😺 smiley_cat|😸 smile_cat|😹 joy_cat|😻 heart_eyes_cat|😼 smirk_cat|🙀 scream_cat|😿 crying_cat_face|😾 pouting_cat",
	],
	[
		"People",
		"👋 wave|🤚 raised_back_of_hand|✋ raised_hand|🖖 vulcan|👌 ok_hand|🤏 pinching_hand|✌️ v|🤞 crossed_fingers|🤟 love_you|🤘 metal|🤙 call_me|👈 point_left|👉 point_right|👆 point_up_2|👇 point_down|☝️ point_up|👍 thumbsup +1|👎 thumbsdown -1|✊ fist|👊 punch|🤛 left_facing_fist|🤜 right_facing_fist|👏 clap|🙌 raised_hands|👐 open_hands|🤲 palms_up|🤝 handshake|🙏 pray|✍️ writing_hand|💅 nail_care|💪 muscle|🧠 brain|👀 eyes|👁️ eye|👅 tongue|🙋 raising_hand|🙇 bow|🤦 facepalm|🤷 shrug|🙅 no_good|🙆 ok_person|💁 tipping_hand|🧑‍💻 technologist|🥷 ninja|🧙 mage|🧛 vampire|🧟 zombie|🦸 superhero|💃 dancer|🕺 man_dancing|🏃 runner|🚶 walking|👶 baby|👑 crown|🎩 tophat|🧢 billed_cap|👓 eyeglasses|🕶️ dark_sunglasses",
	],
	[
		"Symbols",
		"❤️ heart|🧡 orange_heart|💛 yellow_heart|💚 green_heart|💙 blue_heart|💜 purple_heart|🖤 black_heart|🤍 white_heart|🤎 brown_heart|💔 broken_heart|❣️ heart_exclamation|💕 two_hearts|💞 revolving_hearts|💓 heartbeat|💗 heartpulse|💖 sparkling_heart|💘 cupid|💝 gift_heart|💯 100|💢 anger|💥 boom|💫 dizzy|💦 sweat_drops|💨 dash|💬 speech_balloon|💭 thought_balloon|💤 zzz|✨ sparkles|⭐ star|🌟 star2|🔥 fire|⚡ zap|✅ white_check_mark|✔️ heavy_check_mark|❌ x|⚠️ warning|❗ exclamation|❓ question|‼️ bangbang|⁉️ interrobang|🚫 no_entry_sign|⛔ no_entry|🆗 ok|🆕 new|🆒 cool|♻️ recycle|➕ heavy_plus_sign|➖ heavy_minus_sign|🔴 red_circle|🟠 orange_circle|🟡 yellow_circle|🟢 green_circle|🔵 blue_circle|🟣 purple_circle|⚫ black_circle|⚪ white_circle|🎵 musical_note|🎶 notes|➡️ arrow_right|⬅️ arrow_left|⬆️ arrow_up|⬇️ arrow_down|🔁 repeat|🔔 bell|🔕 no_bell|📢 loudspeaker|📣 mega|🏳️‍🌈 rainbow_flag|🏴‍☠️ pirate_flag|🏁 checkered_flag|🚩 triangular_flag",
	],
	[
		"Nature",
		"🐶 dog|🐱 cat|🐭 mouse|🐹 hamster|🐰 rabbit|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger|🦁 lion|🐮 cow|🐷 pig|🐸 frog|🐵 monkey_face|🙈 see_no_evil|🙉 hear_no_evil|🙊 speak_no_evil|🐔 chicken|🐧 penguin|🐦 bird|🐤 baby_chick|🦆 duck|🦅 eagle|🦉 owl|🦇 bat|🐺 wolf|🐴 horse|🦄 unicorn|🐝 bee|🐛 bug|🦋 butterfly|🐌 snail|🐞 lady_beetle|🐢 turtle|🐍 snake|🦎 lizard|🦖 t_rex|🐙 octopus|🦀 crab|🐠 tropical_fish|🐟 fish|🐬 dolphin|🐳 whale|🦈 shark|🐊 crocodile|🦒 giraffe|🐘 elephant|🌵 cactus|🎄 christmas_tree|🌲 evergreen_tree|🌳 deciduous_tree|🌴 palm_tree|🌱 seedling|🌿 herb|🍀 four_leaf_clover|🍁 maple_leaf|🍄 mushroom|🌸 cherry_blossom|🌹 rose|🌻 sunflower|🌷 tulip|🌎 earth_americas|🌙 crescent_moon|☀️ sunny|⛅ partly_sunny|🌧️ cloud_with_rain|❄️ snowflake|🌈 rainbow|🌊 ocean|💧 droplet",
	],
	[
		"Food",
		"🍏 green_apple|🍎 apple|🍐 pear|🍊 tangerine|🍋 lemon|🍌 banana|🍉 watermelon|🍇 grapes|🍓 strawberry|🍒 cherries|🍑 peach|🥭 mango|🍍 pineapple|🥥 coconut|🥝 kiwi|🍅 tomato|🥑 avocado|🥕 carrot|🌽 corn|🥔 potato|🍞 bread|🥐 croissant|🧀 cheese|🥚 egg|🍳 cooking|🥓 bacon|🍔 hamburger|🍟 fries|🍕 pizza|🌭 hotdog|🌮 taco|🌯 burrito|🍝 spaghetti|🍜 ramen|🍣 sushi|🍙 rice_ball|🍦 icecream|🍩 doughnut|🍪 cookie|🎂 birthday|🍰 cake|🧁 cupcake|🍫 chocolate_bar|🍬 candy|🍭 lollipop|🍿 popcorn|🧂 salt|☕ coffee|🍵 tea|🧃 beverage_box|🥤 cup_with_straw|🧋 bubble_tea|🍺 beer|🍻 beers|🥂 clinking_glasses|🍷 wine_glass",
	],
	[
		"Objects",
		"⚽ soccer|🏀 basketball|🏈 football|⚾ baseball|🎾 tennis|🏐 volleyball|🎱 8ball|🏓 ping_pong|🏆 trophy|🥇 first_place|🥈 second_place|🥉 third_place|🏅 medal|🎮 video_game|🕹️ joystick|🎲 game_die|🧩 jigsaw|♟️ chess_pawn|🎯 dart|🎳 bowling|🎨 art|🎬 clapper|🎤 microphone|🎧 headphones|🎸 guitar|🎹 musical_keyboard|🥁 drum|🎉 tada|🎊 confetti_ball|🎈 balloon|🎁 gift|🎃 jack_o_lantern|🎆 fireworks|💻 computer|🖥️ desktop_computer|⌨️ keyboard|🖱️ computer_mouse|📱 mobile_phone|📷 camera|💡 bulb|🔦 flashlight|📚 books|📖 book|✏️ pencil|📝 memo|📌 pushpin|📎 paperclip|🔒 lock|🔓 unlock|🔑 key|🔨 hammer|🛠️ hammer_and_wrench|⚙️ gear|🧱 bricks|💣 bomb|🗡️ dagger|⚔️ crossed_swords|🛡️ shield|🏹 bow_and_arrow|💰 moneybag|💵 dollar|💎 gem|⏰ alarm_clock|⌛ hourglass|📦 package|🚀 rocket|✈️ airplane|🚗 car|🚲 bike|🛸 flying_saucer|🏠 house|🏰 castle|⛺ tent|🗿 moyai|🌋 volcano|🏝️ desert_island",
	],
]

export type Emoji = { emoji: string; names: string[] }

export const categories = data.map(([name, list]) => ({
	name,
	emoji: list.split("|").map(entry => {
		const [emoji, ...names] = entry.split(" ")
		return { emoji, names } as Emoji
	}),
}))

/** Shortcode name to emoji, e.g. "joy" to "😂" */
export const shortcodes = new Map(
	categories.flatMap(c =>
		c.emoji.flatMap(e => e.names.map(n => [n, e.emoji]))
	)
)

/** The emoji people can react with: the ones in the picker */
export const reactable = new Set(
	categories.flatMap(c => c.emoji.map(e => e.emoji))
)

/** Emoji whose names start with (or else contain) the text typed after a colon */
export function search(query: string, limit = 8) {
	const q = query.toLowerCase()
	const all = categories.flatMap(c => c.emoji)
	const starts = all.filter(e => e.names.some(n => n.startsWith(q)))
	const contains = all.filter(
		e => !starts.includes(e) && e.names.some(n => n.includes(q))
	)
	return [...starts, ...contains].slice(0, limit)
}
