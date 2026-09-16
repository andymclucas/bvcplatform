// Detects Meta in-app browser (Facebook, Instagram) and shows a warning.
export default function MetaBrowserBanner() {
  const ua = navigator.userAgent;
  const isMeta = /FBAN|FBAV|Instagram|FB_IAB/.test(ua);
  if (!isMeta) return null;
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm px-4 py-2 text-center">
      For the best experience, open this app in your default browser.
    </div>
  );
}
