# 正式上线 Smoke Test Checklist

本文用于正式上线前后的快速冒烟检查，目标是在 15-30 分钟内确认公开站点、交易链路、会员链路、后台运营链路与 SEO 基线均可用。

## 1. 上线前准备

- 确认 `NEXT_PUBLIC_SITE_URL` 指向正式域名。
- 确认生产数据库 migration 已全部执行完成。
- 确认 Supabase 生产环境可读写，匿名访问与后台权限配置正确。
- 确认支付、配送、短信/邮件、Webhook 等第三方密钥已切换到生产值。
- 确认本次发布已通过 `npm run lint`，且无 error 级别问题。

## 2. 首页与公开页

逐页访问并确认状态码为 200、页面可正常渲染、无明显布局错位、无控制台致命报错：

- `/`
- `/about`
- `/contact`
- `/faq`
- `/faq/delivery`
- `/faq/shop`
- `/faq/member`
- `/outlets`
- `/terms`
- `/privacy`
- `/refund-policy`

检查项：

- 顶部导航与底部页脚链接正确。
- Logo、Banner、门店图片可正常加载。
- 页面标题、描述、主文案未出现占位内容。
- 移动端与桌面端首屏都可用。

## 3. Shop 链路

访问：

- `/shop`
- `/shop/bundles`
- `/shop/detail?id=<有效商品ID>`
- `/shop/bundle?id=<有效bundleID>`

检查项：

- 商品、Bundle、价格、图片、库存/状态展示正确。
- 加入购物车、修改数量、移除商品可正常工作。
- 购物车金额、套餐自动价/手动价展示正确。
- `/shop/checkout` 可打开，但不应被搜索引擎抓取。

下单冒烟：

- 使用 1 个有效商品完成一次最小金额下单。
- 确认支付结果页 `/payment/result` 正常返回。
- 确认后台订单列表出现新订单。
- 确认订单明细、收货信息、金额字段正确。

## 4. Delivery 链路

访问：

- `/delivery`
- `/delivery/checkout`

检查项：

- 菜单分类、单品、组合、加料组选项正常展示。
- 购物车加减、规格/加料选择、金额计算正确。
- 配送地址与配送费规则生效。
- 成功提交一笔测试订单后，后台外卖订单可见。

## 5. 会员链路

检查以下页面：

- `/register`
- `/login`
- `/member/dashboard`
- `/member/profile`
- `/member/coupons`
- `/member/rewards`
- `/member/referrals`
- `/member/orders/shop`
- `/member/orders/delivery`

检查项：

- 新用户注册、已有用户登录可用。
- 会员资料读取与更新成功。
- 优惠券列表、积分信息、订单列表可正常加载。
- 未登录访问会员页时，拦截逻辑符合预期。

## 6. 后台链路

使用管理员账号检查：

- `/admin`
- `/admin/reports`
- `/admin/shop`
- `/admin/delivery`
- `/admin/platform/coupons`
- `/admin/platform/points-campaigns`
- `/admin/platform/system-health`
- `/admin/users/customers`

检查项：

- 后台登录、导航、返回路径正常。
- 列表页可加载，无白屏或阻塞报错。
- 编辑页打开后能正确回填数据。
- 保存、上下架、删除、筛选、导出 CSV 等关键操作可用。
- 订单、优惠券、积分活动、系统健康数据能正常刷新。

## 7. 支付与履约

至少验证 1 次真实或沙盒交易：

- 支付创建成功。
- 支付完成后订单状态正确更新。
- 重复刷新支付结果页不会产生脏写。
- 外卖订单派单/配送状态链路不报错。
- 若启用 Payex/Lalamove，对应后台健康页数据能看到最新记录。

## 8. SEO / 抓取基线

检查：

- `/robots.txt`
- `/sitemap.xml`

确认项：

- 公开页已允许抓取。
- `/admin/`、`/member/`、`/merchant/`、`/auth/`、`/payment/` 被禁止抓取。
- `/shop/checkout` 与 `/delivery/checkout` 不被抓取。
- `sitemap.xml` 中包含核心公开页与动态商品/Bundle 详情页。
- 公开页 canonical、title、description 合理。

## 9. 回归重点

本轮特别需要关注：

- 后台编辑页数据是否在“取回后一次性回填”，避免二次 effect 造成级联渲染。
- `reports` 页面筛选、导出、用户详情弹窗是否正常。
- `platform/coupons`、`platform/points-campaigns`、`platform/system-health` 首次加载是否正常。
- `robots.ts` 是否已放行全部公开页面。

## 10. 上线后 30 分钟观察

- 观察前端错误监控是否出现新报错峰值。
- 观察后台是否能持续新增订单、优惠券、积分流水。
- 抽查 1 笔商城订单与 1 笔外卖订单的完整状态流转。
- 抽查搜索引擎访问的 `robots.txt` 与 `sitemap.xml` 返回内容是否为最新版本。
- 若有告警系统，确认未出现支付、派单、数据库权限异常。

## 11. 失败回滚标准

满足任一条件应暂停放量或回滚：

- 公开首页、`shop`、`delivery` 任一主入口不可访问。
- 下单或支付主链路失败。
- 后台订单/编辑核心功能不可用。
- 会员登录或资料读取异常。
- 生产环境出现新的 error 级别 lint/编译/运行时阻塞问题。
