// The hero world: a velvet room where each person's voice is a stream of particles. Streams from people who pressed
// "Caption me" calm down as they reach the lens and turn into its green; streams from people who did not are muffled
// and scatter before they get there. A tapped reply flies back from the lens to the person who asked.
import * as THREE from 'three'

const MAX = 6, PER = 2200, MOTES = 3000
export const KIND = { CAPTIONED: 0, MUFFLED: 1, REPLY: 2 }

const bgFrag = /* glsl */`
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uRip[6];
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a*n(p); p *= 2.03; a *= .5; } return s; }
void main(){
  vec2 uv = vUv, asp = vec2(uRes.x/uRes.y, 1.);
  vec3 deep = vec3(.733,.604,.58), base = vec3(.812,.702,.678), light = vec3(.886,.808,.788);
  float nap = fbm(uv*asp*vec2(2.2, 4.5) + vec2(uTime*.012, -uTime*.02));
  vec3 c = mix(deep, light, smoothstep(.25, .8, nap));
  c = mix(c, base, .45);
  // velvet pile: fine vertical ribs that catch the light unevenly
  float rib = sin(uv.x*uRes.x*.12 + fbm(uv*vec2(2., 9.) + uTime*.01)*9.) * .5 + .5;
  c *= 1. - rib*.012*(.5 + nap);
  // a voice in the room: soft rings spreading from where it started
  for (int i = 0; i < 6; i++){
    float age = uTime - uRip[i].z;
    if (age < 0. || age > 4.) continue;
    float d = length((uv - uRip[i].xy)*asp);
    float ring = exp(-pow((d - age*.22)*26., 2.)) * exp(-age*.9);
    c = mix(c, vec3(.141,.078,.106), ring*.11);
  }
  c *= mix(.86, 1., smoothstep(1.15, .35, length((uv - vec2(.55, .55))*asp*.8)));
  gl_FragColor = vec4(c, 1.);
}`

const streamVert = /* glsl */`
attribute float aS; attribute vec4 aR;
uniform vec3 uA[${MAX}]; uniform vec3 uB[${MAX}]; uniform float uAct[${MAX}]; uniform float uKind[${MAX}];
uniform vec2 uHalf; uniform float uTime; uniform float uPix;
varying float vAlpha; varying vec3 vCol;
vec3 bez(vec3 a, vec3 b, vec3 c, float t){ return mix(mix(a, b, t), mix(b, c, t), t); }
void main(){
  int s = int(aS);
  float kind = uKind[s];
  float pr = fract(aR.y + uTime*(.26 + aR.x*.24));
  vec3 spread = vec3((aR.z - .5)*2.*uHalf.x*.92, (aR.w - .5)*2.*uHalf.y*.8, 0.);
  vec3 A = uA[s] + (kind == 2. ? spread : vec3(0.));
  vec3 B = uB[s] + (kind == 0. ? spread : vec3(0.));
  float reach = kind == 1. ? .6 : 1.;
  float q = pr*reach;
  vec3 mid = vec3(mix(A.x, B.x, .68), min(A.y, B.y) + .2 - aR.x*.7, 1.4 + aR.z*1.4); // arc low, under the copy, then up into the lens
  vec3 p = bez(A, mid, B, q);
  vec3 dir = normalize(B - A), side = normalize(cross(dir, vec3(0., 0., 1.)));
  float amp = kind == 1. ? .18 + q*1.6 : (kind == 2. ? .12*sin(q*3.14) : .26*(1. - smoothstep(.45, .95, q)));
  p += side*sin(q*24. - uTime*7. + aR.z*6.283)*amp*(.4 + aR.w);
  if (kind == 1.) p += vec3(aR.z - .5, aR.w - .5, aR.x - .5)*smoothstep(.25, .6, q)*2.2;
  vec4 mv = modelViewMatrix*vec4(p, 1.);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = (2.2 + aR.w*3.4)*uPix*(10. / -mv.z);
  float fade = smoothstep(0., .07, pr)*(1. - smoothstep(.88, 1., pr));
  vec3 ink = vec3(.26, .1, .16), green = vec3(.3, .94, .35), muted = vec3(.55, .44, .46);
  vCol = kind == 1. ? muted : (kind == 2. ? mix(green, ink, smoothstep(.2, .9, q)) : mix(ink, green, smoothstep(.7, .95, q)));
  vAlpha = uAct[s]*fade*(kind == 1. ? 1. - smoothstep(.35, .6, q)*.9 : 1.);
}`
const streamFrag = /* glsl */`
precision highp float; varying float vAlpha; varying vec3 vCol;
void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(vCol, vAlpha*.9*smoothstep(.5, .1, d)); }`

const moteVert = /* glsl */`
attribute vec4 aR; uniform float uTime; uniform float uPix; uniform vec3 uSpan; varying float vA;
void main(){
  vec3 p = (aR.xyz - .5)*uSpan;
  p.y = mod(p.y + uTime*(.04 + aR.w*.06) + uSpan.y*.5, uSpan.y) - uSpan.y*.5;
  p.x += sin(uTime*.3 + aR.w*20.)*.25;
  vec4 mv = modelViewMatrix*vec4(p, 1.);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = (1. + aR.w*1.8)*uPix*(9. / -mv.z);
  vA = .18 + .3*aR.w;
}`
const moteFrag = /* glsl */`
precision highp float; varying float vA;
void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(.141, .078, .106, vA*smoothstep(.5, .1, d)); }`

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100)
  camera.position.set(0, 0, 12)

  const rip = Array.from({ length: 6 }, () => new THREE.Vector3(0, 0, -99))
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: bgFrag, depthTest: false, depthWrite: false,
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uRip: { value: rip } },
  }))
  bg.frustumCulled = false; bg.renderOrder = -1
  scene.add(bg)

  const A = Array.from({ length: MAX }, () => new THREE.Vector3(0, -9, 0)), B = Array.from({ length: MAX }, () => new THREE.Vector3())
  const act = new Array(MAX).fill(0), kind = new Array(MAX).fill(0), goal = new Array(MAX).fill(0)
  const g = new THREE.BufferGeometry()
  const aS = new Float32Array(MAX * PER), aR = new Float32Array(MAX * PER * 4)
  for (let i = 0; i < MAX * PER; i++) { aS[i] = Math.floor(i / PER); for (let k = 0; k < 4; k++) aR[i * 4 + k] = Math.random() }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * PER * 3), 3))
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); g.setAttribute('aR', new THREE.BufferAttribute(aR, 4))
  const streamMat = new THREE.ShaderMaterial({
    vertexShader: streamVert, fragmentShader: streamFrag, transparent: true, depthWrite: false,
    uniforms: { uA: { value: A }, uB: { value: B }, uAct: { value: act }, uKind: { value: kind }, uHalf: { value: new THREE.Vector2(2, 1) }, uTime: { value: 0 }, uPix: { value: dpr } },
  })
  const streams = new THREE.Points(g, streamMat); streams.frustumCulled = false
  scene.add(streams)

  const mg = new THREE.BufferGeometry(), mr = new Float32Array(MOTES * 4)
  for (let i = 0; i < mr.length; i++) mr[i] = Math.random()
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3)); mg.setAttribute('aR', new THREE.BufferAttribute(mr, 4))
  const moteMat = new THREE.ShaderMaterial({ vertexShader: moteVert, fragmentShader: moteFrag, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPix: { value: dpr }, uSpan: { value: new THREE.Vector3(30, 18, 10) } } })
  const motes = new THREE.Points(mg, moteMat); motes.frustumCulled = false
  scene.add(motes)

  // screen pixel -> point on the z = 0 plane, so streams start and end exactly at the DOM seats and lens
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ndc = new THREE.Vector2()
  const toWorld = (x, y, out = new THREE.Vector3()) => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    return ray.ray.intersectPlane(plane, out) ?? out
  }

  let w = 1, h = 1
  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.position.z = w < 700 ? 16 : 12 // portrait: pull back so the streams fit
    camera.updateProjectionMatrix()
    bg.material.uniforms.uRes.value.set(w * dpr, h * dpr)
  }

  const look = { x: 0, y: 0, tx: 0, ty: 0, story: 0 }
  addEventListener('pointermove', e => { look.tx = e.clientX / innerWidth - .5; look.ty = e.clientY / innerHeight - .5 })

  let running = false, raf = 0, last = performance.now(), slow = 0, onFrame = null
  const t0 = performance.now(), elapsed = () => (performance.now() - t0) / 1000
  function frame() {
    raf = requestAnimationFrame(frame)
    const now = performance.now(), dt = now - last; last = now
    // adaptive quality: drop resolution when frames stay slow
    slow = dt > 22 ? slow + 1 : Math.max(0, slow - 1)
    if (slow > 40 && dpr > .75) { dpr = Math.max(.75, dpr - .25); renderer.setPixelRatio(dpr); streamMat.uniforms.uPix.value = moteMat.uniforms.uPix.value = dpr; resize(); slow = 0 }
    const t = elapsed()
    onFrame?.(t)
    for (let i = 0; i < MAX; i++) act[i] += (goal[i] - act[i]) * .06
    look.x += (look.tx - look.x) * .04; look.y += (look.ty - look.y) * .04
    camera.position.x = look.x * .5 + Math.sin(t * .1) * .15
    camera.position.y = -look.y * .35 - look.story * .12
    camera.lookAt(0, 0, 0)
    bg.material.uniforms.uTime.value = streamMat.uniforms.uTime.value = moteMat.uniforms.uTime.value = t
    renderer.render(scene, camera)
  }

  resize()
  const api = {
    // seats: [{ x, y, kind }] in screen px (index = stream), lens: DOMRect; reply stream goes to `replyTo`
    layout(seats, lens, replyTo) {
      camera.updateMatrixWorld()
      const c = toWorld(lens.left + lens.width / 2, lens.top + lens.height / 2)
      const tl = toWorld(lens.left, lens.top)
      streamMat.uniforms.uHalf.value.set(Math.abs(c.x - tl.x), Math.abs(c.y - tl.y))
      seats.forEach((s, i) => { if (i >= MAX - 1) return; toWorld(s.x, s.y, A[i]); B[i].copy(c); kind[i] = s.kind })
      const R = MAX - 1
      kind[R] = KIND.REPLY; A[R].copy(c)
      if (replyTo) toWorld(replyTo.x, replyTo.y, B[R])
    },
    set(i, level) { goal[i] = level },
    ripple(x, y) {
      const r = canvas.getBoundingClientRect(), oldest = rip.reduce((a, b) => (a.z < b.z ? a : b))
      oldest.set((x - r.left) / r.width, 1 - (y - r.top) / r.height, elapsed())
    },
    story(p) { look.story = p },
    onFrame(fn) { onFrame = fn },
    resize,
    play() { if (!running) { running = true; last = performance.now(); frame() } },
    pause() { running = false; cancelAnimationFrame(raf) },
    renderer,
  }
  return api
}
