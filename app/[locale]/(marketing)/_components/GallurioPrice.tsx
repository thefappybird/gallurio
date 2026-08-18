type Period = "monthly" | "yearly";

export async function GallurioPrice({ period: _period }: { period?: Period }) {
  return <>₱250/mo</>;
}
