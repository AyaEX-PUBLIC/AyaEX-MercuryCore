// Small synthesised sound effects (no audio files), muted with the speaker
// toggle in the casino header.

export const sound = $state({ on: true })

const key = "casinoSound"
export function loadSound() {
	try {
		sound.on = localStorage.getItem(key) !== "off"
	} catch {}
}
export function toggleSound() {
	sound.on = !sound.on
	try {
		localStorage.setItem(key, sound.on ? "on" : "off")
	} catch {}
}

let ctx: AudioContext | undefined
function audio() {
	if (!sound.on || typeof AudioContext === "undefined") return
	ctx ??= new AudioContext()
	if (ctx.state === "suspended") ctx.resume()
	return ctx
}

function tone(freq: number, at: number, length: number, type: OscillatorType = "sine", volume = 0.08, slideTo?: number) {
	const a = audio()
	if (!a) return
	const start = a.currentTime + at
	const osc = a.createOscillator()
	const gain = a.createGain()
	osc.type = type
	osc.frequency.setValueAtTime(freq, start)
	if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length)
	gain.gain.setValueAtTime(0.0001, start)
	gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
	gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
	osc.connect(gain).connect(a.destination)
	osc.start(start)
	osc.stop(start + length + 0.05)
}

function noise(at: number, length: number, volume: number, cutoff: number) {
	const a = audio()
	if (!a) return
	const start = a.currentTime + at
	const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * length), a.sampleRate)
	const samples = buffer.getChannelData(0)
	for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2
	const source = a.createBufferSource()
	source.buffer = buffer
	const filter = a.createBiquadFilter()
	filter.type = "lowpass"
	filter.frequency.setValueAtTime(cutoff, start)
	filter.frequency.exponentialRampToValueAtTime(80, start + length)
	const gain = a.createGain()
	gain.gain.value = volume
	source.connect(filter).connect(gain).connect(a.destination)
	source.start(start)
}

const scale = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093]

export const sfx = {
	click: () => tone(900, 0, 0.03, "square", 0.025),
	tick: (pitch = 1) => tone(500 * pitch, 0, 0.05, "triangle", 0.05),
	reelStop: () => {
		tone(140, 0, 0.12, "triangle", 0.16, 90)
		noise(0, 0.06, 0.08, 2000)
	},
	gem: (step = 0) => {
		const f = scale[step % scale.length] * (step >= scale.length ? 2 : 1)
		tone(f, 0, 0.18, "sine", 0.09)
		tone(f * 1.5, 0.05, 0.2, "sine", 0.05)
	},
	win: () => [0, 1, 2].forEach(i => tone(scale[i], i * 0.07, 0.25, "triangle", 0.08)),
	lose: () => tone(300, 0, 0.35, "sawtooth", 0.04, 120),
	boom: () => {
		noise(0, 0.9, 0.45, 1400)
		tone(110, 0, 0.6, "sine", 0.3, 35)
	},
	cashOut: () => {
		;[0, 2, 4, 3].forEach((n, i) => tone(scale[n], i * 0.06, 0.22, "square", 0.04))
		tone(2637, 0.28, 0.4, "sine", 0.05)
	},
	coin: (pitch = 1) => {
		tone(1318 * pitch, 0, 0.06, "square", 0.025)
		tone(1976 * pitch, 0.05, 0.16, "square", 0.025)
	},
	fanfare: (tier: "big" | "mega" | "jackpot") => {
		const notes = tier === "big" ? [0, 2, 4, 3] : tier === "mega" ? [0, 1, 2, 3, 4, 5, 3] : [0, 1, 2, 3, 2, 3, 4, 5, 6]
		notes.forEach((n, i) => {
			tone(scale[n], i * 0.11, 0.35, "square", 0.045)
			tone(scale[n] / 2, i * 0.11, 0.35, "triangle", 0.06)
		})
		const end = notes.length * 0.11
		;[0, 2, 4].forEach(n => tone(scale[n] * 2, end, 1.2, "triangle", 0.05))
	},
}
