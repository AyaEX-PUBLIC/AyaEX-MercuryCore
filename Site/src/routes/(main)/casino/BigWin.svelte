<script lang="ts">
	import { page } from "$app/state"
	import { celebration, money, reducedMotion } from "./casino.svelte"
	import { sfx } from "./sfx.svelte"

	// Full screen celebration for big wins: light rays, a coin fountain, a
	// count-up of the amount and a screen shake, bigger for each tier.

	const tiers = {
		big: { title: "BIG WIN", countUp: 2200, stay: 2200, coins: 3, shake: "shake-sm" },
		mega: { title: "MEGA WIN", countUp: 3500, stay: 2600, coins: 6, shake: "shake-md" },
		jackpot: { title: "JACKPOT", countUp: 5000, stay: 3200, coins: 10, shake: "shake-lg" },
	}

	const win = $derived(celebration.current)
	const tier = $derived(win ? tiers[win.tier] : null)

	let shown = $state(0)
	let landed = $state(false)
	let leaving = $state(false)
	let canvas: HTMLCanvasElement | undefined = $state()

	function shake(name: string) {
		if (reducedMotion()) return
		const root = document.documentElement
		root.classList.remove("shake-sm", "shake-md", "shake-lg")
		void root.offsetWidth // restart the animation
		root.classList.add(name)
		setTimeout(() => root.classList.remove(name), 900)
	}

	function close() {
		if (leaving) return
		leaving = true
		const id = celebration.current?.id
		setTimeout(() => {
			if (celebration.current?.id === id) celebration.current = null
			leaving = false
		}, 450)
	}

	// a gold coin, drawn once and squashed horizontally to spin it
	function coinSprite(size: number) {
		const c = document.createElement("canvas")
		c.width = c.height = size
		const g = c.getContext("2d") as CanvasRenderingContext2D
		const r = size / 2
		const outer = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.1, r, r, r)
		outer.addColorStop(0, "#fff7c2")
		outer.addColorStop(0.45, "#ffd23f")
		outer.addColorStop(1, "#b7791f")
		g.fillStyle = outer
		g.beginPath()
		g.arc(r, r, r - 1, 0, Math.PI * 2)
		g.fill()
		g.strokeStyle = "#8a5a12"
		g.lineWidth = size * 0.06
		g.beginPath()
		g.arc(r, r, r * 0.72, 0, Math.PI * 2)
		g.stroke()
		g.fillStyle = "#8a5a12"
		g.font = `bold ${size * 0.5}px sans-serif`
		g.textAlign = "center"
		g.textBaseline = "middle"
		g.fillText(page.data.currencySymbol ?? "$", r, r + size * 0.03)
		return c
	}

	type Particle = { x: number; y: number; vx: number; vy: number; spin: number; angle: number; size: number; colour?: string }

	$effect(() => {
		if (!win || !tier || !canvas) return
		const current = win
		const settings = tier
		const reduced = reducedMotion()
		const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		const resize = () => {
			if (!canvas) return
			canvas.width = innerWidth * dpr
			canvas.height = innerHeight * dpr
		}
		resize()
		addEventListener("resize", resize)

		const sprite = coinSprite(64)
		const particles: Particle[] = []
		const confetti = ["#ff4d6d", "#ffd23f", "#4dd4ff", "#7cff6b", "#c77dff", "#ff9f1c"]
		const spawn = (count: number, fromTop = false) => {
			for (let i = 0; i < count; i++) {
				const w = innerWidth
				const h = innerHeight
				const isConfetti = current.tier === "jackpot" && Math.random() < 0.35
				particles.push(
					fromTop
						? { x: Math.random() * w, y: -40, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 3 + 2, spin: Math.random() * 0.3 + 0.05, angle: Math.random() * 6, size: 18 + Math.random() * 22, colour: isConfetti ? confetti[i % confetti.length] : undefined }
						: { x: w / 2 + (Math.random() - 0.5) * w * 0.25, y: h + 30, vx: (Math.random() - 0.5) * 14, vy: -(Math.random() * 12 + h / 55), spin: Math.random() * 0.3 + 0.05, angle: Math.random() * 6, size: 22 + Math.random() * 26, colour: isConfetti ? confetti[i % confetti.length] : undefined }
				)
			}
		}

		sfx.fanfare(current.tier)
		shake(settings.shake)
		shown = 0
		landed = false

		const start = performance.now()
		let frame = 0
		let lastTick = 0
		let raf = 0
		let finishedAt = 0
		const loop = (now: number) => {
			const t = Math.max(now - start, 0) // frame times can precede `start`
			// count up, easing out so the last digits roll in slowly
			const p = Math.min(t / settings.countUp, 1)
			shown = current.amount * (1 - (1 - p) ** 4)
			if (p < 1 && now - lastTick > 70 + p * 120) {
				lastTick = now
				sfx.coin(0.8 + p * 0.6)
			}
			if (p === 1 && !finishedAt) {
				finishedAt = now
				landed = true
				shake(settings.shake)
				sfx.cashOut()
				if (!reduced) spawn(settings.coins * 12)
			}

			if (!reduced && frame % 2 === 0 && t < settings.countUp + 600) {
				spawn(settings.coins)
				if (current.tier !== "big") spawn(Math.ceil(settings.coins / 3), true)
			}
			frame++

			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			ctx.clearRect(0, 0, innerWidth, innerHeight)
			for (let i = particles.length - 1; i >= 0; i--) {
				const pt = particles[i]
				pt.vy += 0.35
				pt.vx *= 0.995
				pt.x += pt.vx
				pt.y += pt.vy
				pt.angle += pt.spin
				if (pt.y > innerHeight + 60 && pt.vy > 0) {
					particles.splice(i, 1)
					continue
				}
				ctx.save()
				ctx.translate(pt.x, pt.y)
				if (pt.colour) {
					ctx.rotate(pt.angle)
					ctx.scale(1, Math.cos(pt.angle * 1.7))
					ctx.fillStyle = pt.colour
					ctx.fillRect(-pt.size / 4, -pt.size / 8, pt.size / 2, pt.size / 4)
				} else {
					ctx.scale(Math.max(Math.abs(Math.cos(pt.angle)), 0.08), 1)
					ctx.drawImage(sprite, -pt.size / 2, -pt.size / 2, pt.size, pt.size)
				}
				ctx.restore()
			}

			if (finishedAt && now - finishedAt > settings.stay) close()
			if (!finishedAt || particles.length || now - finishedAt < settings.stay + 500) raf = requestAnimationFrame(loop)
		}
		raf = requestAnimationFrame(loop)

		const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === " " || e.key === "Enter") && close()
		addEventListener("keydown", onKey)
		return () => {
			cancelAnimationFrame(raf)
			removeEventListener("resize", resize)
			removeEventListener("keydown", onKey)
		}
	})
</script>

{#if win && tier}
	{#key win.id}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="overlay {win.tier}"
			class:leaving
			role="dialog"
			aria-label="{tier.title}: {money(win.amount)}"
			tabindex="-1"
			onclick={close}>
			<div class="rays"></div>
			<div class="rays reverse"></div>
			<canvas bind:this={canvas}></canvas>
			<div class="content">
				<div class="title" aria-hidden="true">
					{#each tier.title.split("") as letter, i}
						<span style="--i: {i}">{letter === " " ? " " : letter}</span>
					{/each}
				</div>
				<div class="amount" class:landed>
					{page.data.currencySymbol}{money(Math.floor(shown))}
				</div>
				<div class="multiplier">×{win.multiplier.toLocaleString("en-US")}</div>
				<div class="hint">Click to continue</div>
			</div>
		</div>
	{/key}
{/if}

<style>
	:global(html.shake-sm) {
		animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97);
		--s: 4px;
	}
	:global(html.shake-md) {
		animation: shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97);
		--s: 8px;
	}
	:global(html.shake-lg) {
		animation: shake 0.85s cubic-bezier(0.36, 0.07, 0.19, 0.97);
		--s: 14px;
	}
	@keyframes shake {
		10%,
		90% {
			transform: translate(calc(var(--s) * -0.3), calc(var(--s) * 0.2));
		}
		20%,
		80% {
			transform: translate(calc(var(--s) * 0.6), calc(var(--s) * -0.4));
		}
		30%,
		50%,
		70% {
			transform: translate(calc(var(--s) * -1), calc(var(--s) * 0.5));
		}
		40%,
		60% {
			transform: translate(var(--s), calc(var(--s) * -0.6));
		}
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		overflow: hidden;
		cursor: pointer;
		background: radial-gradient(circle at center, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.88));
		animation: fade-in 0.35s ease-out;
		--glow: #ffd23f;
		--a: #fff3b0;
		--b: #ffc300;
		--c: #e07a00;
	}
	.overlay.mega {
		--glow: #ff4fd8;
		--a: #ffe0fb;
		--b: #ff6ad5;
		--c: #8b3dff;
	}
	.overlay.jackpot {
		--glow: #ff3355;
		--a: #fff;
		--b: #ffd23f;
		--c: #ff2e63;
	}
	.overlay.leaving {
		animation: fade-out 0.45s ease-in forwards;
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.rays {
		position: absolute;
		width: 220vmax;
		height: 220vmax;
		left: 50%;
		top: 50%;
		margin: -110vmax 0 0 -110vmax;
		background: repeating-conic-gradient(
			from 0deg,
			color-mix(in srgb, var(--glow) 32%, transparent) 0deg 7deg,
			transparent 7deg 18deg
		);
		mask-image: radial-gradient(circle, black 0%, transparent 30%);
		animation: spin 14s linear infinite;
	}
	.rays.reverse {
		animation-direction: reverse;
		animation-duration: 22s;
		opacity: 0.6;
	}
	.jackpot .rays {
		animation-duration: 6s;
	}
	.content {
		position: relative;
		text-align: center;
		animation: pop 0.7s cubic-bezier(0.18, 1.6, 0.4, 1);
		padding: 0 1rem;
	}
	.title {
		font-size: clamp(2.6rem, 11vw, 6.5rem);
		font-weight: 900;
		letter-spacing: 0.04em;
		line-height: 1;
		white-space: nowrap;
	}
	.title span {
		display: inline-block;
		background: linear-gradient(180deg, var(--a) 10%, var(--b) 50%, var(--c) 90%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
		filter: drop-shadow(0 0 18px var(--glow)) drop-shadow(0 4px 0 rgb(0 0 0 / 0.6));
		animation:
			drop 0.6s calc(var(--i) * 70ms) cubic-bezier(0.2, 1.8, 0.4, 1) backwards,
			bob 1.6s calc(var(--i) * 90ms + 0.6s) ease-in-out infinite;
	}
	.jackpot .title span {
		animation:
			drop 0.6s calc(var(--i) * 70ms) cubic-bezier(0.2, 1.8, 0.4, 1) backwards,
			bob 1.2s calc(var(--i) * 90ms + 0.6s) ease-in-out infinite,
			hue 1.5s linear infinite;
	}
	.amount {
		margin-top: 1rem;
		font-size: clamp(2rem, 8vw, 4.5rem);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: #fff;
		text-shadow:
			0 0 24px var(--glow),
			0 3px 0 rgb(0 0 0 / 0.5);
	}
	.amount.landed {
		animation: thump 0.5s cubic-bezier(0.2, 1.8, 0.4, 1);
		color: var(--a);
	}
	.multiplier {
		margin-top: 0.4rem;
		display: inline-block;
		padding: 0.2rem 1rem;
		border-radius: 999px;
		font-weight: 700;
		font-size: 1.3rem;
		color: #1b1300;
		background: linear-gradient(90deg, var(--b), var(--a), var(--b));
		background-size: 200% 100%;
		animation: shimmer 1.5s linear infinite;
	}
	.hint {
		margin-top: 1.5rem;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.9rem;
		animation: fade-in 0.5s 2s backwards;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes pop {
		from {
			transform: scale(0.2);
			opacity: 0;
		}
	}
	@keyframes drop {
		from {
			transform: translateY(-120px) scale(1.6) rotate(-12deg);
			opacity: 0;
		}
	}
	@keyframes bob {
		50% {
			transform: translateY(-8px) scale(1.04);
		}
	}
	@keyframes hue {
		to {
			filter: hue-rotate(360deg) drop-shadow(0 0 18px var(--glow));
		}
	}
	@keyframes thump {
		40% {
			transform: scale(1.3);
		}
	}
	@keyframes shimmer {
		to {
			background-position: -200% 0;
		}
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
	@keyframes fade-out {
		to {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.rays,
		.title span,
		.multiplier {
			animation: none;
		}
	}
</style>
