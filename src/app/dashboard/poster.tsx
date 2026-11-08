import Image from "next/image";
import { findPosterUrl } from "@/lib/tmdb";

// Width classes shared by the poster and its placeholder so nothing jumps
// when the poster arrives. Posters are 2:3 (width:height).
const SIZE = "w-24 shrink-0 sm:w-32";

// Server component: looks up the poster on TMDB. Renders nothing if there
// isn't one (or TMDB is down), so the title simply takes the full width.
export async function Poster({ movie }: { movie: string }) {
  const url = await findPosterUrl(movie);
  if (!url) return null;

  return (
    <Image
      src={url}
      alt={`Poster for ${movie}`}
      width={128}
      height={192}
      className={`${SIZE} h-auto rounded-sm border border-line`}
    />
  );
}

export function PosterPlaceholder() {
  return <div className={`${SIZE} aspect-[2/3] animate-pulse rounded-sm bg-panel`} />;
}
