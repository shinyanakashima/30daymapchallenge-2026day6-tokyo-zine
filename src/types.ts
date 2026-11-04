export type Place = {
  id: string
  no: string
  name: string
  ja: string
  kind: string
  lng: number
  lat: number
  text: string
  source: string
}

export type Manifest = {
  scene: {
    product_id: string
    satellite: string
    sensor: string
    acquired_utc: string
    acquired_date: string
    wrs_path_row: string
    scene_cloud_cover_pct: number
    processing_level: string
    source_crs: string
    native_resolution_m: number
  }
  processing: {
    bands: { R: string; G: string; B: string }
    output: { file: string; width: number; height: number }
  }
  coordinates: [number, number][]
  credit: string
  license: string
}
