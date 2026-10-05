<script lang="ts">
	import { onMount } from "svelte"
	import Head from "$components/Head.svelte"
	import { crashMultiplierAt, crashRate, crashTimeTo } from "$lib/casinoMath"
	import BetInput from "../BetInput.svelte"
	import { casinoApi, celebrate, money, reducedMotion, settle, spend } from "../casino.svelte"
	import { sfx } from "../sfx.svelte"

	const { data } = $props()

	type State = {
		status: "active" | "won" | "lost"
		multiplier: number
		elapsed?: number
		crashPoint?: number
		payout?: number
		bet: number
		autoCashOut?: number
		balance?: number | null
	}

	let bet = $state(10)
	let auto: number | null = $state(null) // number inputs bind numbers (null when empty)
	let error = $state("")
	let busy = $state(false)

	// idle → running → (cashed →) crashed; "cashed" keeps the rocket flying to
	// its crash point after the player got out
	let phase: "idle" | "running" | "cashed" | "crashed" = $state("idle")
	let multiplier = $state(1)
	let roundBet = $state(0)
	let cashed: { multiplier: number; payout: number; time: number } | null = $state(null)
	let crashPoint: number | null = $state(null)
	let history: number[] = $state([])
	let shaking = $state(false)

	let time = 0 // ms into the round, as animated
	let speed = 1
	let canvas: HTMLCanvasElement | undefined = $state()
	let polling = false

	const live = $derived(phase === "running")

	function begin(elapsed: number, betAmount: number) {
		time = elapsed
		speed = 1
		roundBet = betAmount
		cashed = null
		crashPoint = null
		multiplier = crashMultiplierAt(elapsed)
		particles.length = 0
		phase = "running"
	}

	async function start() {
		if (busy || live) return
		error = ""
		const autoValue = auto || undefined
		if (autoValue !== undefined && !(autoValue >= 1.01)) {
			error = "Auto cash out must be at least 1.01×"
			return
		}
		busy = true
		try {
			await casinoApi<State>("crash", { bet, autoCashOut: autoValue })
			spend(bet)
			sfx.click()
			begin(0, bet)
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}

	async function cashOut() {
		if (!live || busy) return
		busy = true
		try {
			apply(await casinoApi<State>("crash/cashout", {}))
		} catch (e) {
			error = (e as Error).message
		}
		busy = false
	}

	// the server's verdict on the running round
	function apply(state: State) {
		if (phase !== "running") return
		if (state.status === "won") {
			crashPoint = state.crashPoint ?? null
			const at = state.multiplier
			cashed = { multiplier: at, payout: state.payout ?? 0, time: crashTimeTo(at) }
			multiplier = at
			time = Math.max(time, cashed.time)
			// fly on to the crash point, faster when it's far off
			const left = crashPoint ? crashTimeTo(crashPoint) - time : 0
			speed = Math.max(1, left / 2500)
			phase = "cashed"
			sfx.cashOut()
			celebrate(cashed.payout, at)
			settle(state.balance)
		} else if (state.status === "lost") {
			crashPoint = state.crashPoint ?? state.multiplier
			crash()
			settle(state.balance)
		}
	}

	function crash() {
		if (crashPoint) {
			time = crashTimeTo(crashPoint)
			multiplier = crashPoint
			history = [crashPoint, ...history].slice(0, 12)
		}
		phase = "crashed"
		explode = true
		sfx.boom()
		if (!reducedMotion()) {
			shaking = true
			setTimeout(() => (shaking = false), 600)
		}
	}

	async function poll() {
		if (polling || phase !== "running") return
		polling = true
		try {
			const state = await casinoApi<State | null>("crash")
			if (state && state.status !== "active") apply(state)
		} catch {}
		polling = false
	}

	onMount(() => {
		casinoApi<State | null>("crash")
			.then(state => {
				if (state?.status === "active") begin(state.elapsed ?? 0, state.bet)
			})
			.catch(() => {})
		const timer = setInterval(poll, 150)
		return () => clearInterval(timer)
	})

	// --- drawing ---

	type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number }
	const particles: Particle[] = []
	const stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * 0.8 + 0.2 }))
	let explode = false
	let lastTick = 0

	function niceStep(range: number, lines: number) {
		const raw = range / lines
		const power = 10 ** Math.floor(Math.log10(raw))
		for (const m of [1, 2, 5, 10]) if (m * power >= raw) return m * power
		return 10 * power
	}

	$effect(() => {
		if (!canvas) return
		const el = canvas
		const ctx = el.getContext("2d") as CanvasRenderingContext2D
		let w = 0
		let h = 0
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		const resize = () => {
			w = el.clientWidth
			h = el.clientHeight
			el.width = w * dpr
			el.height = h * dpr
		}
		resize()
		const observer = new ResizeObserver(resize)
		observer.observe(el)

		let raf = 0
		let last = performance.now()
		const draw = (now: number) => {
			const dt = Math.min(Math.max(now - last, 0), 100)
			last = now
			if (phase === "running" || phase === "cashed") {
				time += dt * speed
				const current = crashMultiplierAt(time)
				multiplier = current
				if (phase === "cashed" && crashPoint && time >= crashTimeTo(crashPoint)) crash()
				const step = Math.floor(Math.log(current) * 20)
				if (step !== lastTick && phase === "running") {
					lastTick = step
					sfx.tick(1 + Math.min(Math.log(current), 3) * 0.5)
				}
			}
			const shown = Math.max(crashMultiplierAt(time), 1)

			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			ctx.clearRect(0, 0, w, h)

			// stars drift faster as the rocket speeds up
			const drift = phase === "running" || phase === "cashed" ? 0.0002 * dt * Math.min(shown, 8) : 0
			ctx.fillStyle = "#fff"
			for (const s of stars) {
				s.x -= drift * s.z
				s.y += drift * s.z * 0.6
				if (s.x < 0) s.x += 1
				if (s.y > 1) s.y -= 1
				ctx.globalAlpha = 0.25 + s.z * 0.5
				ctx.fillRect(s.x * w, s.y * h, s.z * 2, s.z * 2)
			}
			ctx.globalAlpha = 1

			const pad = { l: 44, r: 24, t: 24, b: 28 }
			const xMax = Math.max(10_000, time * 1.15)
			const yMax = Math.max(2, shown * 1.2)
			const X = (t: number) => pad.l + (t / xMax) * (w - pad.l - pad.r)
			const Y = (m: number) => h - pad.b - ((m - 1) / (yMax - 1)) * (h - pad.t - pad.b)

			// axes
			ctx.font = "11px sans-serif"
			ctx.fillStyle = "rgb(255 255 255 / 0.45)"
			ctx.strokeStyle = "rgb(255 255 255 / 0.08)"
			ctx.lineWidth = 1
			const yStep = niceStep(yMax - 1, 4)
			for (let m = 1; m <= yMax; m += yStep) {
				const y = Y(m)
				ctx.beginPath()
				ctx.moveTo(pad.l, y)
				ctx.lineTo(w - pad.r, y)
				ctx.stroke()
				ctx.fillText(`${+m.toFixed(2)}×`, 4, y + 4)
			}
			const xStep = niceStep(xMax / 1000, 5)
			for (let s = xStep; s * 1000 <= xMax; s += xStep) ctx.fillText(`${+s.toFixed(1)}s`, X(s * 1000) - 8, h - 8)

			if (phase === "idle") {
				raf = requestAnimationFrame(draw)
				return
			}

			// the curve
			const colour = phase === "crashed" ? "#ef4444" : phase === "cashed" ? "#22c55e" : "#ff9f1c"
			const points = 90
			ctx.beginPath()
			for (let i = 0; i <= points; i++) {
				const t = (time * i) / points
				const x = X(t)
				const y = Y(Math.exp(crashRate * t))
				i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
			}
			const tipX = X(time)
			const tipY = Y(shown)
			ctx.save()
			ctx.lineTo(tipX, h - pad.b)
			ctx.lineTo(X(0), h - pad.b)
			ctx.closePath()
			const fill = ctx.createLinearGradient(0, tipY, 0, h - pad.b)
			fill.addColorStop(0, `${colour}66`)
			fill.addColorStop(1, `${colour}00`)
			ctx.fillStyle = fill
			ctx.fill()
			ctx.restore()

			ctx.beginPath()
			for (let i = 0; i <= points; i++) {
				const t = (time * i) / points
				i ? ctx.lineTo(X(t), Y(Math.exp(crashRate * t))) : ctx.moveTo(X(t), Y(1))
			}
			ctx.strokeStyle = colour
			ctx.lineWidth = 4
			ctx.lineCap = "round"
			ctx.shadowColor = colour
			ctx.shadowBlur = 16
			ctx.stroke()
			// the stretch the player rode stays green
			if (cashed && phase === "crashed") {
				const end = cashed.time
				ctx.beginPath()
				for (let i = 0; i <= points; i++) {
					const t = (end * i) / points
					i ? ctx.lineTo(X(t), Y(Math.exp(crashRate * t))) : ctx.moveTo(X(t), Y(1))
				}
				ctx.strokeStyle = ctx.shadowColor = "#22c55e"
				ctx.stroke()
			}
			ctx.shadowBlur = 0

			// where the player cashed out
			if (cashed) {
				const x = X(cashed.time)
				const y = Y(cashed.multiplier)
				ctx.fillStyle = "#22c55e"
				ctx.beginPath()
				ctx.arc(x, y, 7, 0, Math.PI * 2)
				ctx.fill()
				ctx.fillStyle = "#fff"
				ctx.font = "bold 13px sans-serif"
				ctx.fillText(`+${data.currencySymbol}${money(cashed.payout)}`, x + 10, y + 20)
			}

			// direction of travel, for the rocket and its exhaust
			const back = Math.max(time - 300, 0)
			const dx = tipX - X(back)
			const dy = tipY - Y(crashMultiplierAt(back) || 1)
			const angle = Math.atan2(dy, dx || 1)

			if (explode) {
				explode = false
				for (let i = 0; i < 90; i++) {
					const a = Math.random() * Math.PI * 2
					const v = Math.random() * 7 + 1
					particles.push({ x: tipX, y: tipY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 40 + Math.random() * 40, size: 3 + Math.random() * 6, hue: 10 + Math.random() * 40 })
				}
			} else if (phase !== "crashed" && !reducedMotion()) {
				for (let i = 0; i < 2; i++)
					particles.push({
						x: tipX - Math.cos(angle) * 14,
						y: tipY - Math.sin(angle) * 14,
						vx: -Math.cos(angle) * 2 + (Math.random() - 0.5),
						vy: -Math.sin(angle) * 2 + (Math.random() - 0.5),
						life: 0,
						max: 25 + Math.random() * 15,
						size: 3 + Math.random() * 3,
						hue: 30 + Math.random() * 20,
					})
			}
			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i]
				p.life += dt / 16
				if (p.life > p.max) {
					particles.splice(i, 1)
					continue
				}
				p.x += p.vx
				p.y += p.vy
				p.vx *= 0.96
				p.vy = p.vy * 0.96 + 0.04
				const k = p.life / p.max
				ctx.globalAlpha = 1 - k
				ctx.fillStyle = k > 0.5 ? `hsl(0 0% ${60 - k * 30}%)` : `hsl(${p.hue} 100% ${60 - k * 20}%)`
				ctx.beginPath()
				ctx.arc(p.x, p.y, p.size * (1 + k), 0, Math.PI * 2)
				ctx.fill()
			}
			ctx.globalAlpha = 1

			if (phase !== "crashed") {
				ctx.save()
				ctx.translate(tipX, tipY)
				// the emoji points up and to the right (−45°)
				ctx.rotate(angle + Math.PI / 4)
				ctx.font = "30px sans-serif"
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				ctx.fillText("🚀", 0, 0)
				ctx.restore()
			}

			raf = requestAnimationFrame(draw)
		}
		raf = requestAnimationFrame(draw)
		return () => {
			cancelAnimationFrame(raf)
			observer.disconnect()
		}
	})
</script>

<Head name={data.siteName} title="Crash" />

<div class="grid grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] gap-6 items-start">
	<div class="card bg-darker p-4 flex flex-col gap-4">
		<BetInput bind:bet disabled={live || busy} />
		<label class="flex flex-col gap-1">
			<span class="text-sm grey-text">Auto cash out (optional)</span>
			<div class="flex items-center gap-1">
				<input type="number" min="1.01" step="0.01" placeholder="e.g. 2" bind:value={auto} disabled={live || busy} class="w-full" />
				<span>×</span>
			</div>
		</label>
		{#if live}
			<button type="button" class="btn btn-primary cashout" disabled={busy} onclick={cashOut}>
				Cash out {data.currencySymbol}{money(Math.floor(roundBet * multiplier * 1e6))}
			</button>
		{:else}
			<button type="button" class="btn btn-primary" disabled={busy} onclick={start}>
				{phase === "idle" ? "Launch" : "Launch again"}
			</button>
		{/if}
		{#if error}
			<p class="text-red-500 text-sm">{error}</p>
		{/if}
		{#if history.length}
			<div>
				<span class="text-sm grey-text">Your last rounds</span>
				<div class="flex flex-wrap gap-1 pt-1">
					{#each history as point, i (i + "-" + point + "-" + history.length)}
						<span class="chip" class:good={point >= 2}>{point.toFixed(2)}×</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="stage" class:shaking class:flash-win={phase === "cashed"} class:flash-lose={phase === "crashed"}>
		<canvas bind:this={canvas}></canvas>
		<div class="readout {phase}">
			{#if phase === "idle"}
				<span class="label">Place a bet and launch</span>
			{:else}
				<b style="font-size: {Math.min(3 + Math.log(multiplier) * 0.6, 5)}rem">{multiplier.toFixed(2)}×</b>
				{#if phase === "crashed"}
					<span class="label crashed-label">CRASHED</span>
				{/if}
				{#if cashed}
					<span class="label cashed-label">
						Cashed out at {cashed.multiplier.toFixed(2)}× · +{data.currencySymbol}{money(cashed.payout)}
					</span>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.stage {
		position: relative;
		height: clamp(16rem, 55vw, 26rem);
		border-radius: 1rem;
		overflow: hidden;
		background: radial-gradient(ellipse at 30% 110%, #3b1d6e, #120a2a 55%, #070512);
		box-shadow: inset 0 0 0 2px #2a1d4f;
		transition: box-shadow 0.3s;
	}
	.stage.shaking {
		animation: shake 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97);
	}
	.stage.flash-win {
		box-shadow:
			inset 0 0 0 2px #22c55e,
			inset 0 0 60px #22c55e44;
	}
	.stage.flash-lose {
		box-shadow:
			inset 0 0 0 2px #ef4444,
			inset 0 0 80px #ef444466;
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.readout {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		text-align: center;
		padding: 0 1rem;
	}
	.readout b {
		font-weight: 900;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: #fff;
		text-shadow: 0 4px 20px rgb(0 0 0 / 0.6);
		transition: color 0.2s;
	}
	.readout.cashed b {
		color: #4ade80;
	}
	.readout.crashed b {
		color: #f87171;
		animation: crash-text 0.5s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.label {
		color: rgb(255 255 255 / 0.7);
		font-weight: 600;
	}
	.crashed-label {
		color: #f87171;
		font-size: 1.4rem;
		letter-spacing: 0.2em;
		animation: crash-text 0.5s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.cashed-label {
		margin-top: 0.4rem;
		padding: 0.2rem 0.9rem;
		border-radius: 999px;
		background: rgb(34 197 94 / 0.2);
		color: #4ade80;
		box-shadow: 0 0 0 1px #22c55e;
		animation: crash-text 0.5s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.cashout {
		animation: pulse 0.8s ease-in-out infinite alternate;
	}
	.chip {
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
		background: rgb(239 68 68 / 0.2);
		color: #f87171;
		animation: chip 0.4s cubic-bezier(0.2, 1.8, 0.4, 1);
	}
	.chip.good {
		background: rgb(34 197 94 / 0.2);
		color: #4ade80;
	}
	@keyframes crash-text {
		from {
			transform: scale(1.8);
			opacity: 0;
		}
	}
	@keyframes pulse {
		to {
			box-shadow: 0 0 18px 2px #ff9f1c;
		}
	}
	@keyframes chip {
		from {
			transform: scale(0);
		}
	}
	@keyframes shake {
		10%,
		90% {
			transform: translate(-2px, 1px);
		}
		20%,
		80% {
			transform: translate(6px, -3px);
		}
		30%,
		50%,
		70% {
			transform: translate(-10px, 5px);
		}
		40%,
		60% {
			transform: translate(10px, -5px);
		}
	}
</style>
