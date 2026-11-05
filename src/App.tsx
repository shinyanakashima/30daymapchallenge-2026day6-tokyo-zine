import { useCallback, useEffect, useState } from 'react'
import MapView from './MapView'
import manifestJson from '../public/data/manifest.json'
import placesJson from './data/places.json'
import type { Manifest, Place } from './types'
import { jst, latLng, utcTime } from './format'

const manifest = manifestJson as unknown as Manifest
const places = placesJson.places as Place[]

const EDITIONS = [
  { id: 'newwave', group: 'PRINT', key: 'A', name: 'NEW WAVE' },
  { id: 'pop', group: 'PRINT', key: 'B', name: 'POP' },
  { id: 'tate', group: 'PRINT', key: 'C', name: 'TATEGUMI', ja: '縦組' },
  { id: 'bbs', group: 'SCREEN', key: 'D', name: 'BBS 1990', ja: 'パソコン通信' },
  { id: 'web94', group: 'SCREEN', key: 'E', name: 'WEB 1994' },
  { id: 'web97', group: 'SCREEN', key: 'F', name: 'WEB 1997' },
  { id: 'flash', group: 'SCREEN', key: 'G', name: 'FLASH 2001' },
  { id: 'keitai', group: 'SCREEN', key: 'H', name: 'KEITAI 2002', ja: 'ケータイ' },
  { id: 'web2', group: 'SCREEN', key: 'I', name: 'WEB 2.0' },
] as const
/** editions where number keys pick places and 0 returns to the full view */
const ACCESS_KEYS: readonly string[] = ['bbs', 'keitai']
const GROUPS = ['PRINT', 'SCREEN'] as const
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
  return 'web97'
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
      // BBS / KEITAI editions: number keys pick places, 0 returns to the full view
      if (!ACCESS_KEYS.includes(edition) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '0') fullView()
      const n = Number(e.key)
      if (n >= 1 && n <= places.length) select(places[n - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullView, select, edition])

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
        {GROUPS.map((g) => (
          <span key={g} className="editions__group" role="presentation">
            <span className="editions__glabel">{g}</span>
            {EDITIONS.filter((e) => e.group === g).map((e) => (
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
          </span>
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
          {edition === 'web97' && <span className="mast__online">Online</span>}
          {edition === 'web2' && (
            <span className="beta" aria-hidden="true">
              beta
            </span>
          )}
        </h1>
        {edition === 'bbs' && (
          <pre className="bbs-banner" aria-hidden="true">
            {`*** TOKYO MAP NET へようこそ ***\n画像 TOKYO.MAG を受信しました (${scene.native_resolution_m}m/pixel, ${scene.acquired_date})`}
          </pre>
        )}
        {edition === 'flash' && (
          <p className="y2k-load" aria-hidden="true">
            <span className="y2k-load__bar" />
            <span className="y2k-load__text">
              SCENE LOADED 100% / LANDSAT-5 TM / {scene.acquired_date} {utcTime(scene.acquired_utc)} UTC
            </span>
          </p>
        )}
        {edition === 'pop' && (
          <p className="burst" aria-hidden="true">
            <span>
              SATELLITE
              <br />
              SPECIAL!
            </span>
          </p>
        )}
        {edition === 'tate' && (
          <p className="stamp" lang="ja" aria-hidden="true">
            保存版
          </p>
        )}
        {edition === 'web97' && (
          <>
            <p className="w97-marquee" aria-hidden="true">
              <span>
                ようこそ「TOKYO MAP Online」へ！ ★ {t.year}年{t.month}月{t.day}日 {t.time}、ランドサット5号が撮影した東京を掲載中 ★
                Welcome! Select a place from the menu ★
              </span>
            </p>
            <nav className="w97-nav" aria-label="Sections">
              <a href="#photo">衛星写真 PHOTO</a>
              <a href="#menu">目次 MENU</a>
              <a href="#about">この画像について ABOUT</a>
              <a href="#links">リンク LINKS</a>
            </nav>
          </>
        )}
      </header>

      <section className="lead">
        <h2 className="lead__head">
          THE CITY{' '}
          <br />
          FROM 705 KM UP
        </h2>
        <p className="lead__ja" lang="ja">
          上空705kmのランドサット5号が撮った、{t.year}年{t.month}月{t.day}日の東京。
        </p>
      </section>

      <main className="spread">
        <figure className="plate" id="photo">
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

        <nav className="contents" id="menu" aria-label="Places">
          <h3 className="contents__head">
            CONTENTS <span className="contents__hint">SELECT A PLACE</span>
          </h3>
          <ol className="contents__list">
            {places.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`entry${p.id === selectedId ? ' is-selected' : ''}`}
                  aria-pressed={p.id === selectedId}
                  aria-keyshortcuts={ACCESS_KEYS.includes(edition) ? String(i + 1) : undefined}
                  onClick={() => (p.id === selectedId ? fullView() : select(p.id))}
                >
                  <span className="entry__key" aria-hidden="true">
                    [{i + 1}]
                  </span>
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

      {ACCESS_KEYS.includes(edition) && (
        <p className="k-top">
          <button type="button" onClick={fullView} aria-keyshortcuts="0">
            {edition === 'bbs' ? '0. 全景に戻る (FULL VIEW)' : '[0] 全景に戻る / FULL VIEW'}
          </button>
        </p>
      )}
      {edition === 'bbs' && (
        <p className="bbs-status" aria-hidden="true">
          <span>TOKYO MAP NET</span>
          <span>衛星画像フォーラム</span>
          <span>番号を入力してください (1-{places.length}, 0)</span>
        </p>
      )}

      <footer className="colophon" id="about">
        <p>
          TOKYO MAP is a fictional magazine made for #30DayMapChallenge 2026, Day 6 “Vintage”. Not a reproduction of any real
          publication.
        </p>
        <p>
          Image: {scene.product_id} · {scene.processing_level} · source CRS {scene.source_crs} · {manifest.license}.{' '}
          <a href={`${import.meta.env.BASE_URL}data/manifest.json`}>manifest.json</a>
        </p>
        <p>Type: Archivo Black, Archivo, IBM Plex Mono, Jost, Zen Old Mincho, Michroma, Silkscreen, DotGothic16 (SIL Open Font License).</p>
        {edition === 'web97' && (
          <div className="w97-extra">
            <h4 className="w97-h">更新履歴 WHAT'S NEW</h4>
            <dl className="w97-log">
              <dt>2026.11.04</dt>
              <dd>
                サイトを公開しました。{t.year}年{t.month}月{t.day}日の衛星写真を掲載。 <span className="w97-new">NEW!</span>
              </dd>
            </dl>
            <p className="w97-uc">バックナンバー：準備中 / BACK ISSUES: UNDER CONSTRUCTION</p>
            <p>
              撮影日 SCENE DATE{' '}
              <span className="w97-counter">
                {scene.acquired_date
                  .replace(/-/g, '')
                  .split('')
                  .map((d, i) => (
                    <span key={i}>{d}</span>
                  ))}
              </span>
            </p>
            <h4 className="w97-h" id="links">
              リンク LINKS
            </h4>
            <p>
              <a href="https://www.usgs.gov/landsat-missions/landsat-5">USGS Landsat 5</a> |{' '}
              <a href="https://maps.gsi.go.jp/">GSI Maps</a> | <a href="https://30daymapchallenge.com/">#30DayMapChallenge</a>
            </p>
            <p className="w97-best">このサイトは 800×600 以上の画面でご覧ください。 Best viewed at 800 x 600</p>
          </div>
        )}
      </footer>
    </div>
  )
}
