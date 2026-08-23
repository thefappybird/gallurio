type YouTubeEmbedProps = {
  videoId: string;
  title: string;
  caption?: string;
};

export function YouTubeEmbed({ videoId, title, caption }: YouTubeEmbedProps) {
  return (
    <figure className="my-10">
      <div className="aspect-video overflow-hidden rounded-[var(--radius-surface)] bg-muted ring-1 ring-foreground/10">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      {caption ? <figcaption className="mt-3 text-sm leading-6 text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
