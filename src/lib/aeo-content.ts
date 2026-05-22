import type { OfficialBundle, OfficialSoupPackVariant } from "@/lib/admin/official-shop";
import type { OfficialOutletRow } from "@/lib/admin/official-platform";
import { assetPath, siteConfig } from "@/lib/site-config";

export type AeoFaqItem = {
  question: string;
  answer: string;
};

export type AeoAnswerItem = {
  question: string;
  answer: string;
};

export type AeoDefinedTermItem = {
  name: string;
  description: string;
};

export type AeoPolicySection = {
  title: string;
  paragraphs: string[];
};

export type AeoPolicyDocument = {
  slug: "terms" | "privacy" | "refund-policy";
  path: string;
  title: string;
  label: string;
  description: string;
  intro: string;
  faqItems: AeoFaqItem[];
  sections: AeoPolicySection[];
};

export type AeoFaqTopic = {
  slug: "delivery" | "shop" | "member";
  path: string;
  label: string;
  title: string;
  description: string;
  intro: string;
  items: AeoFaqItem[];
};

export type AeoOutletProfile = {
  id: string;
  name: string;
  label: string;
  summary: string;
  mapsUrl: string;
  whatsappUrl: string;
  photos: string[];
  serviceHighlights: string[];
};

export type AeoOutletDirectoryItem = AeoOutletProfile & {
  location: string | null;
  operatingHours: string | null;
  isActive: boolean;
};

const DEFAULT_PRODUCT_USAGE =
  "解冻后倒入锅中加热至沸腾，建议小火再煮 3-5 分钟；可搭配蔬菜、肉片、面条等一起食用。";
const DEFAULT_PRODUCT_STORAGE =
  "建议 -18°C 冷冻保存。开封后请尽快食用，若冷藏请于 24 小时内食用完毕。";
const DEFAULT_PRODUCT_NOTICE =
  "图片仅供参考，实际以实物为准；如对食材过敏，请先确认配料与食用说明。";

const encodeAssetPath = (path: string) => encodeURI(assetPath(path));

const normalizeText = (value: string | null | undefined, fallback: string) => {
  const output = (value ?? "").trim();
  return output || fallback;
};

const normalizeOutletName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const aeoOutletProfiles: AeoOutletProfile[] = [
  {
    id: "bloomsvale",
    name: "Nan Peng You Hotpot - Bloomsvale",
    label: "Bloomsvale 分店",
    summary: "主打聚餐与活动场景，空间宽敞，适合家庭聚会、朋友聚餐和预约式用餐。",
    mapsUrl: "https://maps.app.goo.gl/86mYMtntgV8npwcy5",
    whatsappUrl: "https://wa.me/60198433519?text=%E6%82%A8%E5%A5%BD%E7%94%B7%E6%9C%8B%E5%8F%8B%E7%81%AB%E9%94%85%EF%BC%8C%E6%88%91%E6%83%B3%E8%A6%81%E8%AE%A2%E4%BD%8D%E3%80%82",
    serviceHighlights: ["适合家庭聚餐", "适合朋友聚会", "可先用 WhatsApp 询问订位"],
    photos: [
      encodeAssetPath("/restaurant/Nan Peng You Hotpot - Bloomsvale/IMG_4885.JPG"),
      encodeAssetPath("/restaurant/Nan Peng You Hotpot - Bloomsvale/IMG_4909.JPG"),
      encodeAssetPath("/restaurant/Nan Peng You Hotpot - Bloomsvale/IMG_4952.JPG"),
      encodeAssetPath("/restaurant/Nan Peng You Hotpot - Bloomsvale/IMG_5027.JPG"),
    ],
  },
  {
    id: "serdang",
    name: "Nan Peng You Hotpot - Serdang",
    label: "Serdang 分店",
    summary: "覆盖周边居民与学生客群，适合日常堂食、快节奏用餐与附近用户就近安排火锅聚餐。",
    mapsUrl: "https://maps.app.goo.gl/XmeCScEz486j72BU8",
    whatsappUrl: "https://wa.me/60168556587?text=%E6%82%A8%E5%A5%BD%E7%94%B7%E6%9C%8B%E5%8F%8B%E7%81%AB%E9%94%85%EF%BC%8C%E6%88%91%E6%83%B3%E8%A6%81%E8%AE%A2%E4%BD%8D%E3%80%82",
    serviceHighlights: ["适合附近居民", "适合学生聚餐", "可先用 WhatsApp 确认营业状态"],
    photos: [
      encodeAssetPath("/restaurant/Nan Peng You Hotpot - Serdang/Copy of IMG_9049.JPG"),
      encodeAssetPath("/restaurant/Nan Peng You Hotpot - Serdang/Image_20230830171132.jpg"),
      encodeAssetPath("/restaurant/Nan Peng You Hotpot - Serdang/Image_20230830171242.jpg"),
      encodeAssetPath("/restaurant/Nan Peng You Hotpot - Serdang/dd1b285c-c6a6-4bf7-84e4-06654b863e17.jpg"),
    ],
  },
];

export function mergeAeoOutlets(outlets: OfficialOutletRow[] = []): AeoOutletDirectoryItem[] {
  const activeOutlets = outlets.filter((item) => item.is_active);
  const officialByName = new Map(activeOutlets.map((item) => [normalizeOutletName(item.name), item]));
  const usedOfficialKeys = new Set<string>();

  const mergedProfiles = aeoOutletProfiles.map((profile) => {
    const normalizedProfileName = normalizeOutletName(profile.name);
    const officialMatch =
      officialByName.get(normalizedProfileName) ??
      activeOutlets.find((item) => normalizedProfileName.includes(normalizeOutletName(item.name)) || normalizeOutletName(item.name).includes(normalizedProfileName)) ??
      null;

    if (officialMatch) usedOfficialKeys.add(normalizeOutletName(officialMatch.name));

    return {
      ...profile,
      location: officialMatch?.location ?? null,
      operatingHours: officialMatch?.operating_hours ?? null,
      isActive: officialMatch?.is_active ?? true,
    };
  });

  const extraOutlets = activeOutlets
    .filter((item) => !usedOfficialKeys.has(normalizeOutletName(item.name)))
    .map((item) => ({
      id: item.id,
      name: item.name,
      label: item.name,
      summary: `${item.name} 提供 ${siteConfig.displayName} 官方门店服务，可用于到店用餐与门店信息查询。`,
      mapsUrl: "",
      whatsappUrl: "",
      photos: [],
      serviceHighlights: ["官方门店", "支持到店用餐", "详情可联系客服确认"],
      location: item.location,
      operatingHours: item.operating_hours,
      isActive: item.is_active,
    }));

  return [...mergedProfiles, ...extraOutlets];
}

export const policyDocuments: AeoPolicyDocument[] = [
  {
    slug: "terms",
    path: "/terms",
    title: "Terms and Conditions",
    label: "条款说明",
    description: "Official terms and conditions for shopping, content usage, delivery, and payments on the Nan Peng You Hotpot website.",
    intro: "本页整理官网使用、商品展示、配送、付款与内容版权等官方条款，方便用户与搜索系统独立索引。",
    faqItems: [
      {
        question: "官网条款主要规范什么？",
        answer: "主要规范网站使用、商品展示、配送说明、付款方式、内容版权，以及用户在官网留言或使用服务时的责任边界。",
      },
      {
        question: "商品图片和实物会完全一致吗？",
        answer: "官网已说明图片主要用于示意，实际商品可能因产品升级、拍摄环境或显示设备差异而有所不同，应以实物为准。",
      },
      {
        question: "付款失败或授权未通过怎么办？",
        answer: "订单付款仍需通过发卡行或支付渠道验证；若未获得授权，平台可能无法完成订单处理，建议更换付款方式或联系客服。",
      },
    ],
    sections: [
      {
        title: "Terms and Conditions",
        paragraphs: [
          "Welcome to nanpengyouhotpot online store. Terms and conditions stated below applies to all visitors and users of nanpengyouhotpot. You are bound by these terms and conditions as long as you're on nanpengyouhotpot.",
        ],
      },
      {
        title: "General",
        paragraphs: [
          "The content of terms and conditions may be change, move or delete at any time. Please note that nanpengyouhotpot have the rights to change the contents of the terms and conditions without any notice.",
          "Any violation of rules and regulations of these terms and conditions, nanpengyouhotpot will take immediate actions against the offender(s).",
        ],
      },
      {
        title: "Images",
        paragraphs: [
          "All pictures shown on this online store are for illustration purpose only. Actual product may vary due to product enhancement.",
        ],
      },
      {
        title: "Site Contents and Copyrights",
        paragraphs: [
          "Unless otherwise noted, all materials, including images, illustrations, designs, icons, photographs, video clips, and written and other materials that appear as part of this Site, in other words Contents of the Site, are copyrights, trademarks, trade dress and/or other intellectual properties owned, controlled or licensed by nanpengyouhotpot.",
        ],
      },
      {
        title: "Comments and Feedbacks",
        paragraphs: [
          "All comments and feedbacks to nanpengyouhotpot will remain nanpengyouhotpot online store.",
          "User shall agree that there will be no comment(s) submitted to nanpengyouhotpot that violate any rights of any third party, including copyrights, trademarks, privacy or other personal or proprietary rights.",
          "Furthermore, the user shall agree there will not be content of unlawful, abusive, or obscene material(s) submitted to the site. User will be the only one responsible for any comment's content made.",
        ],
      },
      {
        title: "Product Information",
        paragraphs: [
          "We cannot guarantee all actual products will be exactly the same shown on the monitor as that is depending on the user monitor.",
        ],
      },
      {
        title: "Newsletter",
        paragraphs: [
          "User shall agree that nanpengyouhotpot may send newsletter regarding the latest news, products, promotions and related updates through email to the user.",
        ],
      },
      {
        title: "Indemnification",
        paragraphs: [
          "The user shall agree to defend, indemnify and hold nanpengyouhotpot harmless from and against any and all claims, damages, costs and expenses, including attorneys' fees, arising from or related to your use of the Site.",
        ],
      },
      {
        title: "Link to Other Sites",
        paragraphs: [
          "Any access link to third party sites is at your own risk. Nanpengyouhotpot will not be related or involved to any such website if the user's content or product got damaged or loss has any connection with third party site.",
        ],
      },
      {
        title: "Inaccuracy Information",
        paragraphs: [
          "From time to time, there may be information on nanpengyouhotpot that contains typographical error, inaccuracies, omissions, that may relate to product description, pricing, availability and article contents.",
          "We reserve the rights to correct any errors, inaccuracies, change or edit information without prior notice to the customers. If you are not satisfy with your purchased product(s), please return it back to us with the invoice.",
        ],
      },
      {
        title: "Shipping and Delivery Policy",
        paragraphs: [
          "Items in stock: 2-5 working days for Standard Delivery items.",
          "Items that are out of stock: Please whatsapp us at 010-9360866 for assistance.",
        ],
      },
      {
        title: "Payments",
        paragraphs: [
          "All goods purchased are subject to a one-time payment. Payment can be made through various payment methods we have available, such as Visa, MasterCard or online payment methods.",
          "Payment cards, including credit cards or debit cards, are subject to validation checks and authorization by your card issuer. If we do not receive the required authorization, we will not be liable for any delay or non-delivery of your order.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    path: "/privacy",
    title: "Privacy Policy",
    label: "隐私政策",
    description: "Official privacy policy for account registration, customer information handling, and security practices on Nan Peng You Hotpot.",
    intro: "本页将注册、订单处理、资料保密和网站安全说明升级为可被索引的独立隐私政策页面。",
    faqItems: [
      {
        question: "官网会收集哪些个人资料？",
        answer: "主要收集注册、下单和填写表单所需的个人资料，例如姓名、电话、邮箱与相关订单信息，用于完成购物与会员服务流程。",
      },
      {
        question: "这些资料会怎么使用？",
        answer: "资料会用于处理订单、维护账户信息、满足法律合规要求，以及向客户同步网站更新、活动与促销信息。",
      },
      {
        question: "平台如何保护个人资料？",
        answer: "官方声明会采取合适的安全措施来保护客户资料，但任何通过互联网传输的信息都不能保证绝对百分之百安全。",
      },
    ],
    sections: [
      {
        title: "Collected Information",
        paragraphs: [
          "We only collect the informations that needed for the registration procedure at our website or when fill up the registration form on the site.",
          "The information that we gathered are voluntarily submitted by the customers to us. We collect customer's personal information during the account registration on our site.",
        ],
      },
      {
        title: "Personal Identification Details",
        paragraphs: [
          "Your personal identification details are used to process your order of the products, customize your profile information, internal usage with legal requirements, update your status of online shopping in our site and also to update our customers with our latest news of updates, changes, promotions and events.",
        ],
      },
      {
        title: "Confidentiality",
        paragraphs: [
          "Your personal information such as credit cards details and bank account numbers are well kept secret and confidential with us.",
          "We will never share any of your personal details to any third party. Our sites do apply appropriate security application in order to keep all the customers information safe at all time.",
        ],
      },
      {
        title: "Changes to Our Privacy Policy",
        paragraphs: [
          "Nanpengyouhotpot have the rights to do any changes or updates to Privacy Policy contents without giving prior notice to the customers. Do keep track on the Privacy Policy page on our website.",
        ],
      },
      {
        title: "Security",
        paragraphs: [
          "Our company website does apply appropriate security application in order to prevent the leaking customers' personal identification details from third parties, illegal disclosure and hackers.",
          "However, bear in mind that any information transmitted through Internet is not 100 percent guaranteed safe and secure.",
        ],
      },
    ],
  },
  {
    slug: "refund-policy",
    path: "/refund-policy",
    title: "Return and Refund Policy",
    label: "退款政策",
    description: "Official return and refund policy for incorrect items, damaged items, timelines, and return responsibilities.",
    intro: "本页独立说明哪些情况可申请退换、申报时限、寄回要求与配送责任边界，便于用户下单前阅读。",
    faqItems: [
      {
        question: "所有商品都能退款吗？",
        answer: "不是。因商品属性关系，官网默认不接受无理由退款或换货，除非收到错误商品或商品有明显物理损坏。",
      },
      {
        question: "发现问题后要在多久内通知？",
        answer: "买家需在发票日期起 7 天内通知官方，以便确认后续退回安排。",
      },
      {
        question: "退回商品时谁负责运费和运输风险？",
        answer: "官方会确认退回安排，但买家需自行承担寄回费用，并在退回运输过程中对商品负责；也可选择退回至实体门店。",
      },
    ],
    sections: [
      {
        title: "Return Eligibility",
        paragraphs: [
          "All products sold through nanpengyouhotpot are not exchangeable and refundable due to the nature of the item, unless wrong item was delivered or item with physical damage.",
        ],
      },
      {
        title: "Delivery Responsibility",
        paragraphs: [
          "Nanpengyouhotpot shall not be liable for any lost package or late delivery that caused by third party delivery partner.",
        ],
      },
      {
        title: "Condition of Returned Products",
        paragraphs: [
          "Returned products must be in original condition and unused.",
        ],
      },
      {
        title: "Return Timeline",
        paragraphs: [
          "The buyer must inform us at nanpengyouhotpot within 7 days period as of the invoice date of the product being returned.",
          "The items must be shipped back within 10 business days from the date of our written letter.",
        ],
      },
      {
        title: "Return Arrangement",
        paragraphs: [
          "Nanpengyouhotpot will confirm with the buyer of returning arrangement and the buyer must ship the product back to nanpengyouhotpot at his or her own cost or return at our physical store.",
          "The buyer will take full responsibility for the products during the return shipment back to us.",
        ],
      },
    ],
  },
];

export function getPolicyDocument(slug: AeoPolicyDocument["slug"]) {
  return policyDocuments.find((item) => item.slug === slug) ?? null;
}

export const faqHubItems: AeoFaqItem[] = [
  {
    question: "男朋友火锅是什么？",
    answer: "男朋友火锅是马来西亚火锅品牌，整合门店堂食、官网火锅外卖和可加热的花胶汤包商城。",
  },
  {
    question: "商城和外卖有什么区别？",
    answer: "外卖适合即点即送、当餐食用；商城适合买可保存、可回家加热的汤包、汤底与礼盒。",
  },
  {
    question: "如果我想更快找到答案，应该先去哪一组 FAQ？",
    answer: "配送问题先看配送 FAQ；商品、下单和加热问题先看商城 FAQ；积分、优惠券和推荐问题先看会员 FAQ。",
  },
];

export const faqTopics: AeoFaqTopic[] = [
  {
    slug: "delivery",
    path: "/faq/delivery",
    label: "配送 FAQ",
    title: "配送 FAQ",
    description: "Answers about hotpot delivery flow, fees, coverage, order timing, and delivery status.",
    intro: "这一组专题页集中回答官网火锅外卖如何下单、运费何时显示、配送合作与订单状态等问题。",
    items: [
      {
        question: "火锅外卖下单前会先看到运费吗？",
        answer: "会。系统会根据收货地址与配送距离计算费用，并在付款前清楚展示。",
      },
      {
        question: "配送费是固定的吗？",
        answer: "不一定。配送费会按地址与实时路程计算，较远地区会显示相应费用，用户确认后再支付。",
      },
      {
        question: "官网外卖由谁配送？",
        answer: "目前官网外卖与配送合作伙伴履约，系统会根据订单地址安排配送并同步状态。",
      },
      {
        question: "支付成功后就等于配送完成了吗？",
        answer: "不是。支付成功表示付款已完成，配送状态会继续更新，用户可在订单记录查看后续进度。",
      },
      {
        question: "适合什么时候选外卖而不是商城？",
        answer: "如果你想当餐就吃、连火锅食材和汤底一起配送，适合选外卖；如果想囤货或回家慢慢加热，则更适合商城。",
      },
      {
        question: "如果配送范围或时间不确定怎么办？",
        answer: `建议先进入外卖页面模拟下单，系统会按地址展示可用信息；若仍不确定，可联系 ${siteConfig.phone} 进一步确认。`,
      },
    ],
  },
  {
    slug: "shop",
    path: "/faq/shop",
    label: "商城 FAQ",
    title: "商城 FAQ",
    description: "Answers about soup pack shopping, heating, storage, bundle sets, and purchase decisions.",
    intro: "这一组专题页集中说明即食汤包、Bundle Set、加热方法、保存方式与商城下单判断逻辑。",
    items: [
      {
        question: "商城商品适合什么场景？",
        answer: "适合家庭备餐、送礼、囤货，或想在家快速加热享用滋补汤品的用户。",
      },
      {
        question: "花胶汤包怎么加热？",
        answer: "进入具体商品详情页即可看到加热步骤、保存方式和适合场景说明，按页面指引加热即可。",
      },
      {
        question: "商城单品和 Bundle Set 有什么差别？",
        answer: "单品适合补货和明确购买某一口味；Bundle Set 适合一次性带走多款商品、多人备餐或礼赠组合。",
      },
      {
        question: "商城商品可以保存多久？",
        answer: "具体以商品页保存说明为准，通常建议冷冻保存；开封后应尽快食用，冷藏时请于短时间内完成。",
      },
      {
        question: "如果我只想快速知道该买什么，怎么判断？",
        answer: "想立刻吃火锅先看外卖；想在家慢慢加热、囤货或送礼先看商城；想一次买多款组合可优先看 Bundle Set。",
      },
      {
        question: "商品页为什么会有问答和短答案模块？",
        answer: "这些模块会把商品用途、加热方法、保存方式与适合人群整理得更直接，方便用户快速判断，也方便搜索系统理解页面内容。",
      },
    ],
  },
  {
    slug: "member",
    path: "/faq/member",
    label: "会员 FAQ",
    title: "会员 FAQ",
    description: "Answers about registration, points, referrals, coupons, and member account behavior.",
    intro: "这一组专题页集中回答登录注册、积分累计、推荐有礼、优惠券与会员中心常见问题。",
    items: [
      {
        question: "需要先注册才能下单吗？",
        answer: "若要完成商城或外卖下单，系统会先引导你登录或注册，这样也能累计会员积分。",
      },
      {
        question: "会员积分怎么计算？",
        answer: "会员自购按 RM1 = 1 point 计算；推荐返利仅限一层，上级积分比例按会员等级区分。",
      },
      {
        question: "可以通过推荐链接邀请朋友吗？",
        answer: "可以。会员中心已提供推荐有礼页面，可复制推荐链接或分享给朋友注册使用。",
      },
      {
        question: "会员中心通常可以做什么？",
        answer: "常见功能包括查看个人资料、商城订单、外卖订单、积分、优惠券和推荐记录。",
      },
      {
        question: "优惠券和积分是同一件事吗？",
        answer: "不是。积分用于会员累计与权益体系，优惠券则是可直接用于满足条件订单的优惠工具。",
      },
      {
        question: "如果只是想先逛公开页面，需要先登录吗？",
        answer: "不需要。品牌介绍、FAQ、联系页、政策页和公开商品页面都可直接访问，只有结账和会员中心等功能才会要求登录。",
      },
    ],
  },
];

export function getFaqTopic(slug: AeoFaqTopic["slug"]) {
  return faqTopics.find((item) => item.slug === slug) ?? null;
}

export function getProductAeoContent(product: Pick<OfficialSoupPackVariant, "title" | "usage_text" | "storage_text" | "notice_text">) {
  const usage = normalizeText(product.usage_text, DEFAULT_PRODUCT_USAGE);
  const storage = normalizeText(product.storage_text, DEFAULT_PRODUCT_STORAGE);
  const notice = normalizeText(product.notice_text, DEFAULT_PRODUCT_NOTICE);

  const faqItems: AeoFaqItem[] = [
    {
      question: `${product.title} 怎么加热食用？`,
      answer: usage,
    },
    {
      question: `${product.title} 应该如何保存？`,
      answer: storage,
    },
    {
      question: `${product.title} 和火锅外卖有什么区别？`,
      answer: `这款商品属于 ${siteConfig.displayName} 商城里的可加热即食汤包，适合在家备餐、囤货或送礼；如果你需要现煮火锅和即时配送，应该改看外卖页面。`,
    },
    {
      question: `${product.title} 适合什么人或什么场景购买？`,
      answer: "适合家庭备餐、在家快速开锅、节庆送礼、日常囤货，或想先准备滋补型汤品的人。",
    },
  ];

  const aiAnswerItems: AeoAnswerItem[] = [
    {
      question: `${product.title} 是什么？`,
      answer: `${product.title} 是 ${siteConfig.displayName} 商城里的可加热即食汤包商品，适合在家快速备餐、补货或送礼。`,
    },
    {
      question: `${product.title} 怎么吃最合适？`,
      answer: usage,
    },
    {
      question: `${product.title} 适合谁买？`,
      answer: "适合想在家快速开锅、安排家庭备餐、节庆送礼或日常囤货的用户。",
    },
    {
      question: `${product.title} 购买前要注意什么？`,
      answer: `${storage} ${notice}`,
    },
  ];

  const definedTerms: AeoDefinedTermItem[] = aiAnswerItems.map((item) => ({
    name: item.question.replace(/[？?]$/, ""),
    description: item.answer,
  }));

  const decisionCards = [
    {
      title: "适合谁买",
      description: "适合家庭备餐、节庆送礼、补货囤货，以及想在家快速安排一餐的人。",
    },
    {
      title: "什么时候更适合选商城",
      description: "当你想购买可保存、可冷冻、可回家加热的商品时，商城会比即时外卖更合适。",
    },
    {
      title: "购买前先确认",
      description: `${storage} ${notice}`,
    },
    {
      title: "使用方式",
      description: usage,
    },
  ];

  return {
    usage,
    storage,
    notice,
    faqItems,
    aiAnswerItems,
    definedTerms,
    decisionCards,
  };
}

export function getBundleAeoContent(bundle: Pick<OfficialBundle, "title" | "rule_kind" | "buy_qty" | "free_qty">) {
  const selectionText =
    bundle.rule_kind === "buy_x_get_y"
      ? `当前采用买 ${bundle.buy_qty ?? 0} 送 ${bundle.free_qty ?? 0} 的套餐规则，适合一次性带走多款商品。`
      : "当前为自选组合套餐，可按照页面规则搭配不同商品。";

  const faqItems: AeoFaqItem[] = [
    {
      question: `${bundle.title} 怎么选择内容？`,
      answer: selectionText,
    },
    {
      question: `${bundle.title} 适合什么购买场景？`,
      answer: "适合多人聚餐备料、送礼组合或一次性补足多款汤包；若只想单独补货，可改看商城单品。",
    },
    {
      question: `${bundle.title} 和单品下单有什么不同？`,
      answer: "Bundle Set 更适合一次性完成多款商品选择，方便控制预算与数量；单品更适合明确补货某一口味。",
    },
    {
      question: `${bundle.title} 下单前要注意什么？`,
      answer: "请先确认币种、套数组数、待分配数量和预估金额，确认无误后再加入购物车。",
    },
  ];

  const aiAnswerItems: AeoAnswerItem[] = [
    {
      question: `${bundle.title} 是什么？`,
      answer: `${bundle.title} 是 ${siteConfig.displayName} 商城里的组合型套餐，适合多人备餐、礼赠或一次性补足多款商品。`,
    },
    {
      question: `${bundle.title} 怎么选最清楚？`,
      answer: selectionText,
    },
    {
      question: `${bundle.title} 更适合谁买？`,
      answer: "适合多人聚餐备料、节庆送礼、集中补货和希望一次完成多款搭配的用户。",
    },
    {
      question: `${bundle.title} 下单前要先确认什么？`,
      answer: "建议先确认套数组数、币种、预估金额、待分配数量，以及是否更适合改买单品。",
    },
  ];

  const definedTerms: AeoDefinedTermItem[] = aiAnswerItems.map((item) => ({
    name: item.question.replace(/[？?]$/, ""),
    description: item.answer,
  }));

  const decisionCards = [
    {
      title: "组合规则",
      description: selectionText,
    },
    {
      title: "适合场景",
      description: "适合多人聚餐、节庆送礼、补货型采购，以及想减少逐个选品时间的订单。",
    },
    {
      title: "什么时候改看单品",
      description: "如果你只想补某一种口味，或只打算少量采购，通常单品页会更直接。",
    },
    {
      title: "下单前确认",
      description: "请留意套数组数、可选数量、预估金额和总重，再完成加入购物车。",
    },
  ];

  return {
    faqItems,
    aiAnswerItems,
    definedTerms,
    decisionCards,
  };
}
