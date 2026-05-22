export type GeoStep = {
  name: string;
  text: string;
};

export type QueryMapItem = {
  query: string;
  answer: string;
  href: string;
  cta: string;
};

const defaultHeatingSteps: GeoStep[] = [
  {
    name: "先解冻汤包",
    text: "先将汤包完全解冻，方便后续均匀受热。",
  },
  {
    name: "倒入锅中煮沸",
    text: "把汤包倒入锅中，以中火加热至完全沸腾。",
  },
  {
    name: "转小火继续加热",
    text: "沸腾后转小火继续煮 3-5 分钟，让汤底风味更稳定。",
  },
  {
    name: "按喜好搭配食材",
    text: "可加入蔬菜、肉片、海鲜或面食后即可上桌食用。",
  },
];

const stepNames = ["准备汤包", "开始加热", "继续烹煮", "完成上桌"];

export function buildProductHeatingSteps(usageText?: string | null): GeoStep[] {
  const raw = (usageText ?? "").trim();

  if (!raw) {
    return defaultHeatingSteps;
  }

  const clauses = raw
    .split(/[。；;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (clauses.length < 2) {
    return [
      defaultHeatingSteps[0],
      {
        name: "开始加热",
        text: raw,
      },
      defaultHeatingSteps[2],
      defaultHeatingSteps[3],
    ];
  }

  return clauses.map((item, index) => ({
    name: stepNames[index] ?? `步骤 ${index + 1}`,
    text: item.endsWith("。") ? item : `${item}。`,
  }));
}

export const homeQueryMapItems: QueryMapItem[] = [
  {
    query: "男朋友火锅是什么品牌？",
    answer: "这是一个同时覆盖门店堂食、火锅外卖和即食汤包零售的马来西亚火锅品牌。",
    href: "/",
    cta: "看品牌定义",
  },
  {
    query: "我想买可囤货、可送礼的花胶汤包，应该看哪里？",
    answer: "这类需求应进入商城页，重点看即食汤包、汤底和 Bundle Set。",
    href: "/shop",
    cta: "进入商城",
  },
  {
    query: "我今天就想在家吃火锅，应该选哪一页？",
    answer: "即时在家开锅的需求应进入火锅外卖页，先确认地址、运费和菜品组合。",
    href: "/delivery",
    cta: "进入外卖",
  },
  {
    query: "我想知道某个汤包怎么加热、怎么保存，去哪里看？",
    answer: "进入具体商品详情页，可以直接看到加热方法、保存方式、适合场景和 AI short answers。",
    href: "/shop",
    cta: "查看商品页",
  },
];
