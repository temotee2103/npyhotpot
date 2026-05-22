import DeliveryPageClient from "@/app/delivery/page-client";
import { fetchOfficialMenuCategories, fetchOfficialMenuItems, sortOfficialMenuItemsByCategoryOrder } from "@/lib/admin/official-delivery";
import { buildBreadcrumbList, buildFaqPage, buildPageMetadata, normalizeImageUrl } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

export const metadata = buildPageMetadata({
  title: "Hotpot Delivery",
  description:
    `Order ${siteConfig.nameWithAlias} delivery with soup bases, ingredients, and hotpot favorites prepared for customers in Malaysia.`,
  path: "/delivery",
  keywords: [...siteConfig.keywords, "hotpot delivery malaysia", "delivery menu"],
  image: siteConfig.ogImage,
});

const deliveryFaqItems = [
  {
    question: "男朋友火锅外卖提供什么服务？",
    answer: "火锅外卖页面提供现煮火锅菜品、汤底与配料选择，用户可先填写地址取得配送报价，再完成付款与派送。",
  },
  {
    question: "火锅外卖和商城商品有什么区别？",
    answer: "火锅外卖适合即点即送、当餐食用；商城则更适合买可冷冻保存的汤包、汤底和礼盒，用于囤货或送礼。",
  },
  {
    question: "外卖下单前最重要的确认点是什么？",
    answer: "建议先确认收货地址、配送方式、预计配送费与菜品内容；如果想快速选组合，可先看 Bundle Set 页面获取灵感。",
  },
];

export default async function DeliveryPage() {
  const [categories, menuItems] = await Promise.all([fetchOfficialMenuCategories(), fetchOfficialMenuItems("ala_carte")]);

  const activeCategories = categories.filter((item) => item.is_active);
  const activeItems = sortOfficialMenuItemsByCategoryOrder(
    menuItems.filter((item) => item.is_active),
    activeCategories,
  );

  const deliveryStructuredData = [
    {
      "@context": "https://schema.org",
      "@type": "FoodEstablishment",
      "@id": `${siteConfig.url}/delivery#food-establishment`,
      name: siteConfig.name,
      url: `${siteConfig.url}/delivery`,
      image: [normalizeImageUrl(siteConfig.ogImage)],
      servesCuisine: ["Hotpot", "Chinese"],
      telephone: siteConfig.phone,
      address: {
        "@type": "PostalAddress",
        streetAddress: siteConfig.address,
        addressCountry: "MY",
      },
      hasMenu: `${siteConfig.url}/delivery`,
    },
    buildBreadcrumbList(`${siteConfig.url}/delivery#breadcrumb`, [
      { name: "首页", path: "/" },
      { name: "火锅外卖", path: "/delivery" },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${siteConfig.url}/delivery#categories`,
      name: "Delivery Categories",
      itemListElement: activeCategories.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${siteConfig.url}/delivery#menu`,
      name: "Delivery Menu",
      itemListElement: activeItems.slice(0, 24).map((item, index) => ({
        "@type": "MenuItem",
        position: index + 1,
        name: item.name,
        description: item.description ?? "",
        image: [normalizeImageUrl(item.image_url)],
        offers: {
          "@type": "Offer",
          priceCurrency: "MYR",
          price: Number(item.base_price ?? 0).toFixed(2),
          availability: "https://schema.org/InStock",
        },
      })),
    },
    buildFaqPage(`${siteConfig.url}/delivery#faq`, deliveryFaqItems),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(deliveryStructuredData) }}
      />
      <DeliveryPageClient />
    </>
  );
}
