<script lang="ts">
	// A drifting field of dithered pixels, used behind heroes and banners.
	// WebGL draws one fragment per pixel cell into a small canvas that CSS
	// scales up without smoothing, so it's cheap even at full screen. It
	// pauses while off screen or in a background tab, and draws one still
	// frame when the user prefers reduced motion. Colours come from the theme
	// (--pixel-0 for the background up to --pixel-4 for the brightest pixels).

	import { onMount } from "svelte"
	import type { ClassValue } from "svelte/elements"

	let {
		cell = 4,
		speed = 1,
		density = 1,
		clear = 0,
		clearAt = [0.5, 0.45, 0.4, 0.3],
		fadeTop = 0.1,
		fadeBottom = 0.1,
		seed = 0,
		class: class_ = ""
	}: {
		/** Size of one pixel, in CSS pixels */
		cell?: number
		speed?: number
		/** Multiplies how bright and busy the field is */
		density?: number
		/** 0 to 1: how much to clear an area, e.g. behind text */
		clear?: number
		/** Centre x, centre y (from the top), half-width and half-height of the cleared area, as fractions of the height */
		clearAt?: [number, number, number, number]
		/** Fraction of the height over which the field fades out at the top and bottom */
		fadeTop?: number
		fadeBottom?: number
		seed?: number
		class?: ClassValue
	} = $props()

	let box: HTMLDivElement
	let canvas: HTMLCanvasElement
	let shown = $state(false)

	const vertex = `
		attribute vec2 a;
		void main() { gl_Position = vec4(a, 0.0, 1.0); }`

	const fragment = `
		// Phone GPUs run mediump as 16-bit floats, too coarse for the hash: its
		// noise comes out flat and no pixel lights up. Desktops use 32 bits anyway.
		#ifdef GL_FRAGMENT_PRECISION_HIGH
		precision highp float;
		#else
		precision mediump float;
		#endif
		uniform vec2 cells;
		uniform float time, density, seed, clearAmount, fadeTop, fadeBottom;
		uniform vec4 clearZone;
		uniform vec3 c0, c1, c2, c3, c4;

		float hash(vec2 p) {
			p = fract(p * vec2(234.34, 435.345));
			p += dot(p, p + 34.23);
			return fract(p.x * p.y);
		}

		float noise(vec2 p) {
			vec2 i = floor(p), f = fract(p);
			vec2 u = f * f * (3.0 - 2.0 * f);
			return mix(
				mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
				mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
				u.y);
		}

		float fbm(vec2 p) {
			float v = 0.0, a = 0.5;
			for (int i = 0; i < 4; i++) {
				v += a * noise(p);
				p = p * 2.02 + vec2(17.1, 9.7);
				a *= 0.5;
			}
			return v;
		}

		// ordered dithering threshold, 0 to 1, from an 8x8 Bayer matrix
		float bayer2(vec2 a) {
			a = floor(a);
			return fract(a.x * 0.5 + a.y * a.y * 0.75);
		}
		float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
		float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

		void main() {
			vec2 cell = floor(gl_FragCoord.xy);
			vec2 uv = (cell + 0.5) / cells;
			float aspect = cells.x / cells.y;
			float t = time * 0.05 + seed;

			// smoke: ribbons along a wavy flow, broken up by noise and
			// drifting to the right
			vec2 p = vec2(uv.x * aspect, uv.y) * 2.2 + vec2(t * 0.8, -t * 0.25);
			vec2 w = p;
			for (int i = 1; i < 6; i++) {
				float k = float(i);
				w += vec2(
					sin(w.y * 1.4 * k + t * 1.7 + k),
					cos(w.x * 1.1 * k - t * 1.3 + 2.0 * k)) * (0.5 / k);
			}
			float ribbon = 1.0 - smoothstep(0.0, 0.75, abs(sin(w.x * 0.7 + w.y * 0.9 - t)));
			float v = 0.85 * ribbon * smoothstep(0.25, 0.68, fbm(p * 1.3 - t));

			// fade out at the edges and around the cleared area
			v *= smoothstep(0.0, fadeBottom + 0.001, uv.y)
				* (1.0 - smoothstep(1.0 - fadeTop - 0.001, 1.0, uv.y));
			vec2 fromTop = vec2(uv.x * aspect, 1.0 - uv.y);
			vec2 zone = (fromTop - vec2(clearZone.x * aspect, clearZone.y)) / clearZone.zw;
			v *= mix(1.0, smoothstep(0.6, 1.4, length(zone)), clearAmount);
			v = clamp(v * density, 0.0, 1.0);

			// a little twinkle: each cell's threshold wobbles a few times a second
			float twinkle = (hash(cell + floor(time * 5.0)) - 0.5) * 0.3;
			float level = floor(v * 4.0 + bayer8(cell) + twinkle);

			vec3 colour = c0;
			if (level >= 4.0) colour = c4;
			else if (level >= 3.0) colour = c3;
			else if (level >= 2.0) colour = c2;
			else if (level >= 1.0) colour = c1;
			gl_FragColor = vec4(colour, 1.0);
		}`

	// Any CSS colour to 0-1 RGB, by letting a canvas parse it
	function rgb(ctx: CanvasRenderingContext2D, colour: string) {
		ctx.fillStyle = "#000"
		ctx.fillStyle = colour.trim() || "#000"
		const hex = ctx.fillStyle // normalised to #rrggbb for opaque colours
		const n = Number.parseInt(hex.slice(1, 7), 16)
		return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
	}

	onMount(() => {
		const gl = canvas.getContext("webgl", {
			antialias: false,
			alpha: false,
			depth: false,
			powerPreference: "low-power",
			preserveDrawingBuffer: false
		})
		if (!gl) return

		const compile = (type: number, source: string) => {
			const shader = gl.createShader(type)
			if (!shader) return null
			gl.shaderSource(shader, source)
			gl.compileShader(shader)
			return gl.getShaderParameter(shader, gl.COMPILE_STATUS)
				? shader
				: null
		}
		const vs = compile(gl.VERTEX_SHADER, vertex)
		const fs = compile(gl.FRAGMENT_SHADER, fragment)
		const program = gl.createProgram()
		if (!vs || !fs || !program) return
		gl.attachShader(program, vs)
		gl.attachShader(program, fs)
		gl.bindAttribLocation(program, 0, "a")
		gl.linkProgram(program)
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
		gl.useProgram(program)

		// one triangle covering the whole canvas
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 3, -1, -1, 3]),
			gl.STATIC_DRAW
		)
		gl.enableVertexAttribArray(0)
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

		const u = (name: string) => gl.getUniformLocation(program, name)
		gl.uniform1f(u("density"), density)
		gl.uniform1f(u("seed"), seed)
		gl.uniform1f(u("clearAmount"), clear)
		gl.uniform1f(u("fadeTop"), fadeTop)
		gl.uniform1f(u("fadeBottom"), fadeBottom)
		gl.uniform4f(u("clearZone"), ...clearAt)

		const style = getComputedStyle(box)
		const parser = document.createElement("canvas").getContext("2d")
		if (parser)
			for (let i = 0; i < 5; i++)
				gl.uniform3fv(
					u(`c${i}`),
					rgb(parser, style.getPropertyValue(`--pixel-${i}`))
				)

		const cellsLoc = u("cells")
		const timeLoc = u("time")
		const px = Math.max(1, Math.round(cell))

		function resize() {
			const w = Math.max(1, Math.ceil(box.clientWidth / px))
			const h = Math.max(1, Math.ceil(box.clientHeight / px))
			canvas.width = w
			canvas.height = h
			canvas.style.width = `${w * px}px`
			canvas.style.height = `${h * px}px`
			gl.viewport(0, 0, w, h)
			gl.uniform2f(cellsLoc, w, h)
		}

		let time = 0
		function draw() {
			gl.uniform1f(timeLoc, time)
			gl.drawArrays(gl.TRIANGLES, 0, 3)
			shown = true
		}

		const still = matchMedia("(prefers-reduced-motion: reduce)")
		let onScreen = false
		let frame = 0
		let last = 0
		let started = 0

		function tick(now: number) {
			frame = requestAnimationFrame(tick)
			if (now - last < 32) return // about 30 frames per second is plenty
			const dt = last ? Math.min(now - last, 100) : 0
			last = now
			started ||= now
			// ease in over the first few seconds instead of starting at full speed
			const ease = Math.min(1, (now - started) / 3000)
			time += (dt / 1000) * speed * ease * ease * (3 - 2 * ease)
			draw()
		}

		function update() {
			cancelAnimationFrame(frame)
			last = 0
			if (still.matches) {
				draw()
				return
			}
			if (onScreen && !document.hidden) frame = requestAnimationFrame(tick)
		}

		const resizer = new ResizeObserver(() => {
			resize()
			draw()
		})
		resizer.observe(box)
		const watcher = new IntersectionObserver(([entry]) => {
			onScreen = entry.isIntersecting
			update()
		})
		watcher.observe(box)
		document.addEventListener("visibilitychange", update)
		still.addEventListener("change", update)
		canvas.addEventListener("webglcontextlost", () =>
			cancelAnimationFrame(frame)
		)

		resize()
		draw()

		return () => {
			cancelAnimationFrame(frame)
			resizer.disconnect()
			watcher.disconnect()
			document.removeEventListener("visibilitychange", update)
			still.removeEventListener("change", update)
			gl.getExtension("WEBGL_lose_context")?.loseContext()
		}
	})
</script>

<div
	bind:this={box}
	aria-hidden="true"
	class={["pixel-field", class_]}>
	<canvas bind:this={canvas} class={{ shown }}></canvas>
</div>

<style>
	.pixel-field {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		background: var(--pixel-0);
	}

	canvas {
		position: absolute;
		left: 0;
		top: 0;
		image-rendering: pixelated;
		opacity: 0;
		transition: opacity 0.8s;
		&.shown {
			opacity: 1;
		}
	}
</style>
