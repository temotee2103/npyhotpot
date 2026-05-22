import Link from "next/link";
import Image from "next/image";
import { assetPath } from "@/lib/site-config";

export function Footer() {
  const paymentPartners = [
    { src: assetPath("/payment/logo-visa.png"), alt: "Visa" },
    { src: assetPath("/payment/logo-mastercard-1.png"), alt: "Mastercard" },
    { src: assetPath("/payment/logo-unionpay-1.png"), alt: "UnionPay" },
    { src: assetPath("/payment/logo-fpx-1.png"), alt: "FPX" },
    { src: assetPath("/payment/logo-duitnow.png"), alt: "DuitNow" },
    { src: assetPath("/payment/logo-touchngo.png"), alt: "Touch 'n Go eWallet" },
    { src: assetPath("/payment/logo-grabpay-1.png"), alt: "GrabPay" },
    { src: assetPath("/payment/logo-shopeepay-1.png"), alt: "ShopeePay" },
  ];

  return (
    <footer className="border-t border-primary/10 bg-[color:var(--theme-surface)] px-4 py-8 backdrop-blur-sm dark:bg-[color:var(--theme-surface)] md:py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-x-10 gap-y-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-y-8">
        <div className="col-span-1 md:col-span-1">
          <div className="mb-4 flex items-center gap-3 md:mb-5">
            <div className="relative h-9 w-36 md:h-11 md:w-44">
              <Image
                src={assetPath("/logo.png")}
                alt="Nanpengyou Hotpot Logo"
                fill
                className="object-contain object-left"
              />
            </div>
          </div>
          <div className="space-y-1.5 leading-relaxed text-[color:var(--theme-muted)]">
            <p className="text-sm font-black">Go Easy Enterprise (M) Sdn. Bhd.</p>
            <p className="text-xs italic">202101016640 (1416940-W)</p>
            <p className="text-xs leading-relaxed">
              3, Jalan Mawar, Seksyen 10,
              <br />
              Taman Perindustrian Bukit Serdang,
              <br />
              43300 Seri Kembangan, Selangor.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5 md:contents">
          <div className="space-y-3 md:space-y-4">
            <h5 className="text-sm font-bold text-[color:var(--foreground)]">公开页面</h5>
            <ul className="space-y-2 text-sm text-[color:var(--theme-muted)]">
              <li><Link className="hover:text-primary" href="/about">品牌故事</Link></li>
              <li><Link className="hover:text-primary" href="/outlets">官方门店页</Link></li>
              <li><Link className="hover:text-primary" href="/contact">联系页面</Link></li>
              <li><Link className="hover:text-primary" href="/member/profile">会员中心</Link></li>
            </ul>
          </div>
          <div className="space-y-3 md:space-y-4">
            <h5 className="text-sm font-bold text-[color:var(--foreground)]">FAQ 专题</h5>
            <ul className="space-y-2 text-sm text-[color:var(--theme-muted)]">
              <li><Link className="hover:text-primary" href="/faq">FAQ 导航页</Link></li>
              <li><Link className="hover:text-primary" href="/faq/delivery">配送 FAQ</Link></li>
              <li><Link className="hover:text-primary" href="/faq/shop">商城 FAQ</Link></li>
              <li><Link className="hover:text-primary" href="/faq/member">会员 FAQ</Link></li>
            </ul>
          </div>
          <div className="col-span-2 space-y-3 md:col-span-1 md:space-y-4">
            <h5 className="text-sm font-bold text-[color:var(--foreground)]">联系我们</h5>
            <div>
              <Link className="text-sm font-bold text-primary hover:text-primary/80" href="/contact">官方联系页</Link>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[color:var(--theme-muted)]">
              <span className="material-symbols-outlined text-base">call</span>
              <span>(60)10-936 0866</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[color:var(--theme-muted)]">
              <span className="material-symbols-outlined text-base">mail</span>
              <span>hi@npyhotpot.com</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-5 max-w-3xl rounded-xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-2 backdrop-blur-sm md:mt-6">
        <p className="text-center text-[10px] font-black tracking-[0.08em] text-primary">PAYMENT PARTNERS</p>
        <div className="mt-1.5 grid grid-cols-4 gap-1 sm:grid-cols-4 lg:grid-cols-8">
          {paymentPartners.map((partner) => (
            <div key={partner.alt} className="flex h-8 items-center justify-center rounded-md border border-[color:var(--theme-border)] bg-white p-0.5 shadow-sm dark:border-[color:var(--theme-border-strong)] dark:bg-white md:h-9">
              <Image src={partner.src} alt={partner.alt} width={96} height={36} className="h-[80%] w-[80%] object-contain" />
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-7xl border-t border-primary/5 pt-6 text-center text-xs text-[color:var(--theme-muted)] md:mt-12 md:pt-8">
        © 2026 Nan Peng You Hotpot. All Rights Reserved.
      </div>
      <div className="mx-auto mt-3 grid max-w-3xl gap-2 text-xs sm:grid-cols-3">
        <Link href="/terms" className="rounded-full border border-primary/30 bg-[color:var(--theme-surface-elevated)] px-3 py-1 text-center font-bold text-primary transition hover:bg-primary/10">
          条款说明
        </Link>
        <Link href="/privacy" className="rounded-full border border-primary/30 bg-[color:var(--theme-surface-elevated)] px-3 py-1 text-center font-bold text-primary transition hover:bg-primary/10">
          隐私政策
        </Link>
        <Link href="/refund-policy" className="rounded-full border border-primary/30 bg-[color:var(--theme-surface-elevated)] px-3 py-1 text-center font-bold text-primary transition hover:bg-primary/10">
          退款政策
        </Link>
      </div>
    </footer>
  );
}
