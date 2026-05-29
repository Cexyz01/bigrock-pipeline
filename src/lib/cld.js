// Cloudinary has been fully removed — all media now lives on Cloudflare R2,
// which has no on-the-fly transform endpoint. This used to inject
// q_auto,f_auto (and optional resize) into Cloudinary delivery URLs.
//
// It is kept as a no-op passthrough so the call sites that still pass a `src`
// through cld() (Img, StoryboardPage, TaskDetailModal, ImageAnnotator,
// ActivityTrackerPage) keep working untouched. The `opts` argument is ignored.
export function cld(url, _opts) {
  return url
}
