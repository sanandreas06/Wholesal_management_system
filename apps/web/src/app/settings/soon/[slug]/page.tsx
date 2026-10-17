import ComingSoon from "../../../../components/settings/ComingSoon";
import { SOON } from "../../../../components/settings/catalog";

export function generateStaticParams() { return Object.keys(SOON).map((slug) => ({ slug })); }
export const dynamicParams = false;
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <ComingSoon slug={slug} />; }
