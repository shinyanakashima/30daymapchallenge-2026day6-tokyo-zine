import { useEffect, useRef } from 'react'
import maplibregl, { type LngLatBoundsLike, type Map as MLMap, type Marker } from 'maplibre-gl'
import type { Manifest, Place } from './types'

type Props = {
  manifest: Manifest
  places: Place[]
  selectedId: string | null
  resetKey: number
  onSelect: (id: string) => void
  onDeselect: () => void
  reducedMotion: boolean
}

// Side of the dot on which each label is printed, chosen to avoid collisions at full view.
const LABEL_SIDE: Record<string, 'l' | 'r' | 'b' | 't' | 'lead'> = {
  shinjuku: 'l',
  shibuya: 'l',
  palace: 'lead',
  ginza: 'r',
  ueno: 't',
  asakusa: 'r',
  sumida: 'r',
  bay: 'l',
}

const MAX_ZOOM = 13 // 30 m pixels: stop before the image turns into blocks
const PLACE_ZOOM_STEP = 1.7 // zoom levels above the full view when a place is selected

export default function MapView({ manifest, places, selectedId, resetKey, onSelect, onDeselect, reducedMotion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const fitZoomRef = useRef(10)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onDeselectRef = useRef(onDeselect)
  onDeselectRef.current = onDeselect
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  const c = manifest.coordinates
  const bounds: LngLatBoundsLike = [
    [c[3][0], c[3][1]],
    [c[1][0], c[1][1]],
  ]

  useEffect(() => {
    const el = containerRef.current!
    const imageUrl = new URL(`${import.meta.env.BASE_URL}${manifest.processing.output.file}`, window.location.href).href
    const map = new maplibregl.Map({
      container: el,
      style: {
        version: 8,
        sources: {
          landsat: { type: 'image', url: imageUrl, coordinates: manifest.coordinates as [[number, number], [number, number], [number, number], [number, number]] },
        },
        layers: [
          { id: 'paper', type: 'background', paint: { 'background-color': '#141210' } },
          { id: 'landsat', type: 'raster', source: 'landsat', paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' } },
        ],
      },
      bounds,
      fitBoundsOptions: { padding: 0 },
      maxZoom: MAX_ZOOM,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
      renderWorldCopies: false,
      cooperativeGestures: false,
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    mapRef.current = map
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) (window as unknown as { __map: MLMap }).__map = map

    const updateLimits = () => {
      const cam = map.cameraForBounds(bounds, { padding: 0 })
      if (!cam || cam.zoom === undefined) return
      fitZoomRef.current = cam.zoom
      map.setMinZoom(Math.max(0, cam.zoom - 0.4))
      map.setMaxBounds(null)
      const [[w, s], [e, n]] = bounds as [[number, number], [number, number]]
      const padLng = (e - w) * 0.15
      const padLat = (n - s) * 0.15
      map.setMaxBounds([
        [w - padLng, s - padLat],
        [e + padLng, n + padLat],
      ])
    }
    map.on('load', updateLimits)
    map.on('resize', () => {
      updateLimits()
      // the plate changes size between editions and breakpoints: keep the full view filling it
      if (selectedRef.current === null) map.fitBounds(bounds, { padding: 0, duration: 0 })
    })

    for (const p of places) {
      const node = document.createElement('button')
      node.type = 'button'
      node.className = `pin pin--${LABEL_SIDE[p.id] ?? 'r'}`
      node.dataset.id = p.id
      // the contents menu carries the accessible control; the pins mirror it with the mouse/touch
      node.tabIndex = -1
      node.setAttribute('aria-hidden', 'true')
      node.innerHTML = `<span class="pin__dot"></span><span class="pin__label"><span class="pin__no">${p.no}</span><span class="pin__name">${p.name}<span class="pin__ja" lang="ja">${p.ja}</span></span></span>`
      node.addEventListener('click', (ev) => {
        ev.stopPropagation()
        onSelectRef.current(p.id)
      })
      const marker = new maplibregl.Marker({ element: node, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map)
      markersRef.current.set(p.id, marker)
    }

    return () => {
      markersRef.current.clear()
      map.remove()
      mapRef.current = null
    }
    // the map is created once; manifest and places are static imports
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // selection -> highlight + camera
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [id, m] of markersRef.current) {
      const el = m.getElement()
      el.classList.toggle('is-selected', id === selectedId)
      el.classList.toggle('is-dimmed', selectedId !== null && id !== selectedId)
      // keep the selected label above its neighbours
      el.style.zIndex = id === selectedId ? '3' : ''
    }
    const p = places.find((x) => x.id === selectedId)
    if (!p) return
    const go = () => {
      const zoom = Math.min(MAX_ZOOM, fitZoomRef.current + PLACE_ZOOM_STEP)
      if (reducedMotion) map.jumpTo({ center: [p.lng, p.lat], zoom })
      else map.flyTo({ center: [p.lng, p.lat], zoom, duration: 900, curve: 1.2, essential: false })
    }
    if (map.loaded()) go()
    else map.once('load', go)
  }, [selectedId, places, reducedMotion])

  // full view
  useEffect(() => {
    const map = mapRef.current
    if (!map || resetKey === 0) return
    map.fitBounds(bounds, { padding: 0, duration: reducedMotion ? 0 : 800 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const zoomBy = (d: number) => {
    const map = mapRef.current
    if (!map) return
    map.easeTo({ zoom: map.getZoom() + d, duration: reducedMotion ? 0 : 250 })
  }

  return (
    <div className="map-shell">
      <div
        ref={containerRef}
        className="map"
        role="img"
        aria-label="Landsat 5 satellite image of central Tokyo and Tokyo Bay with numbered place labels"
      />
      <div className="map-tools" role="group" aria-label="Map view">
        <button type="button" className="tool" onClick={() => zoomBy(1)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="tool" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          −
        </button>
        <button type="button" className="tool tool--wide" onClick={onDeselect}>
          FULL VIEW
        </button>
      </div>
    </div>
  )
}
