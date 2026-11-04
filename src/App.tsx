import { useCallback, useEffect, useState } from 'react'
import MapView from './MapView'
import manifestJson from '../public/data/manifest.json'
import placesJson from './data/places.json'
import type { Manifest, Place } from './types'
import { jst, latLng, utcTime } from './format'

const manifest = manifestJson as unknown as Manifest
const places = placesJson.places as Place[]

const EDITIONS = [
  { id: 'newwave', key: 'A', name: 'NEW WAVE' },
  { id: 'pop', key: 'B', name: 'POP' },
  { id: 'tate', key: 'C', name: 'TATEGUMI', ja: '縦組' },
] as const
type Edition = (typeof EDITIONS)[number]['id']
const isEdition = (v: unknown): v is Edition => EDITIONS.some((e) => e.id === v)

function initialEdition(): Edition {
  const q = new URLSearchParams(window.location.search).get('ed')
  if (isEdition(q)) return q
  try {
    const s = window.localStorage.getItem('tokyo-map-edition')
    if (isEdition(s)) return s
  } catch {
    /* storage unavailable */
  }
  return 'newwave'
}

function useEdition() {
  const [edition, setEdition] = useState<Edition>(initialEdition)
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('ed', edition)
    window.history.replaceState(null, '', url)
    try {
      window.localStorage.setItem('tokyo-map-edition', edition)
    } catch {
      /* storage unavailable */
    }
  }, [edition])
  return [edition, setEdition] as const
}

function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const fn = () => setReduced(m.matches)
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [])
  return reduced
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const reducedMotion = useReducedMotion()
  const [edition, setEdition] = useEdition()

  const scene = manifest.scene
  const t = jst(scene.acquired_utc)
  const selected = places.find((p) => p.id === selectedId) ?? null

  const select = useCallback((id: string) => setSelectedId(id), [])
  const fullView = useCallback(() => {
    setSelectedId(null)
    setResetKey((k) => k + 1)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fullView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullView])

  const bandText = `TOKYO · ${t.day} ${t.monthEn} ${t.year} · ${t.time} JST · SEEN FROM 705 KM · `

  return (
    <div className="page" data-edition={edition}>
      <div className="grain" aria-hidden="true" />
      <div className="band" aria-hidden="true">
        <span>{bandText.repeat(6)}</span>
      </div>
      <div className="dots" aria-hidden="true" />
      <div className="trim" aria-hidden="true" />
      <svg className="confetti" aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <polygon points="8,560 50,520 58,585" className="c1" />
        <polygon points="880,620 940,600 910,660" className="c2" />
        <polygon points="520,940 570,900 585,960" className="c3" />
        <path d="M20 520 q 20 -30 40 0 t 40 0 t 40 0 t 40 0" className="sq1" />
        <path d="M870 150 q 15 -25 30 0 t 30 0 t 30 0" className="sq2" />
        <path d="M470 975 q 15 -25 30 0 t 30 0 t 30 0" className="sq3" />
        <circle cx="960" cy="400" r="14" className="c1" />
        <circle cx="40" cy="880" r="22" className="c2" />
        <rect x="300" y="960" width="40" height="40" transform="rotate(20 320 980)" className="c3" />
      </svg>

      <div className="editions" role="radiogroup" aria-label="Edition (page design)">
        <span className="editions__label">EDITION</span>
        {EDITIONS.map((e) => (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={edition === e.id}
            className={`edition${edition === e.id ? ' is-on' : ''}`}
            onClick={() => setEdition(e.id)}
          >
            <span className="edition__key">{e.key}</span>
            {e.name}
            {'ja' in e && (
              <span className="edition__ja" lang="ja">
                {e.ja}
              </span>
            )}
          </button>
        ))}
      </div>

      <header className="mast">
        <p className="mast__issue">
          <span className="chip">No.06</span> SATELLITE ISSUE · {t.monthEn} {t.year}
        </p>
        <h1 className="mast__title">
          <span className="mast__ja" lang="ja">
            東京地図
          </span>
          <span className="mast__tokyo">TOKYO</span>
          <span className="mast__map">MAP</span>
        </h1>
      </header>

      <section className="lead">
        <h2 className="lead__head">
          THE CITY
          <br />
          FROM 705 KM UP
        </h2>
        <p className="lead__ja" lang="ja">
          上空705kmのランドサット5号が撮った、{t.year}年{t.month}月{t.day}日の東京。
        </p>
      </section>

      <main className="spread">
        <figure className="plate">
          <MapView
            manifest={manifest}
            places={places}
            selectedId={selectedId}
            resetKey={resetKey}
            onSelect={select}
            onDeselect={fullView}
            reducedMotion={reducedMotion}
          />
          <figcaption className="caption">
            <b>PHOTO</b> {scene.satellite} {scene.sensor.replace(' (TM)', '')}, {t.day} {t.monthEn} {t.year}, {t.time} JST (
            {utcTime(scene.acquired_utc)} UTC). Path/Row {scene.wrs_path_row}. Natural colour, R/G/B = TM bands 3/2/1,
            surface reflectance with a display stretch, reprojected to Web Mercator and cropped. {scene.native_resolution_m} m pixels.
            Courtesy of USGS / NASA Landsat. Place positions: present-day GSI address reference points.
          </figcaption>
        </figure>

        <nav className="contents" aria-label="Places">
          <h3 className="contents__head">
            CONTENTS <span className="contents__hint">SELECT A PLACE</span>
          </h3>
          <ol className="contents__list">
            {places.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`entry${p.id === selectedId ? ' is-selected' : ''}`}
                  aria-pressed={p.id === selectedId}
                  onClick={() => (p.id === selectedId ? fullView() : select(p.id))}
                >
                  <span className="entry__no">{p.no}</span>
                  <span className="entry__name">{p.name}</span>
                  <span className="entry__ja" lang="ja">
                    {p.ja}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <article className="story" aria-live="polite">
          {selected ? (
            <>
              <p className="story__kicker">
                <span className="story__no">{selected.no}</span>
                {selected.kind.toUpperCase()}
              </p>
              <h3 className="story__title">
                {selected.name} <span lang="ja">{selected.ja}</span>
              </h3>
              <p className="story__text">{selected.text}</p>
              <p className="story__meta">{latLng(selected.lat, selected.lng)}</p>
              <p className="story__src">POSITION: {selected.source}</p>
              <button type="button" className="back" onClick={fullView}>
                ← BACK TO FULL VIEW
              </button>
            </>
          ) : (
            <>
              <p className="story__kicker">
                <span className="story__no">00</span>HOW TO READ
              </p>
              <h3 className="story__title">ONE MORNING, ONE PICTURE</h3>
              <p className="story__text">
                A single Landsat 5 scene taken at {t.time} on {t.day} {t.monthEn} {t.year}. Rivers, parks and the straight edges of
                reclaimed land show the shape of the city; each pixel is {scene.native_resolution_m} m, too coarse for single
                buildings. Pick a place from the contents or the map. Esc returns to the full view.
              </p>
            </>
          )}
        </article>
      </main>

      <footer className="colophon">
        <p>
          TOKYO MAP is a fictional magazine made for #30DayMapChallenge 2026, Day 6 “Vintage”. Not a reproduction of any real
          publication.
        </p>
        <p>
          Image: {scene.product_id} · {scene.processing_level} · source CRS {scene.source_crs} · {manifest.license}.{' '}
          <a href={`${import.meta.env.BASE_URL}data/manifest.json`}>manifest.json</a>
        </p>
        <p>Type: Archivo Black, Archivo, IBM Plex Mono, Jost, Zen Old Mincho (SIL Open Font License).</p>
      </footer>
    </div>
  )
}
