# 返佣公开账本

基于 GitHub Pages 的只读 Web3 客户返佣看板。客户可通过匿名公开编号或钱包地址查询 GMGN 交易量、返佣计算、人工结算状态和历史付款凭证；运营人员在线下完成转账，再更新公开台账。

项目同时提供独立的 [`referral.html`](./referral.html)，集中展示从 [vlink.cc/tosky](https://vlink.cc/tosky) 核对出的注册和返佣入口。

## 数据边界

看板刻意区分四类数据：

1. **API 观察交易量**：`gmgn-cli portfolio activity` 返回的钱包买卖活动，按 `cost_usd` 汇总并按交易哈希去重。它用于交叉核对，不能单独证明客户属于当前推荐关系。
2. **推荐报告确认量**：运营人员登录 GMGN Referral Report 后录入的确认交易量，是当前返佣计算依据。
3. **人工付款凭证**：实际转账后的批次、锁价、币种数量、时间、交易哈希和区块浏览器链接。
4. **收益测算案例**：`showcase` 使用公开页面人工快照演示返佣公式。带 `placeholder: true` 的上月金额只用于版面占位，不计入真实结算汇总，也不代表已付款。

公开公式：

```text
确认交易量 × GMGN 手续费率 1% × 客户分成比例 30% = 预估返佣
```

因此示例中的“客户分成 30%”对应交易量的有效返佣率为 `0.30%`，不是交易量的 `30%`。

## 本地运行

需要 Node.js 24。

```bash
npm install
npm run dev
```

完整检查：

```bash
npm run check
```

它会依次校验公开 JSON、运行测试、执行 TypeScript 检查并构建两个 HTML 入口。

## 更新公开账本

主要数据文件是 [`public/data/ledger.json`](./public/data/ledger.json)。上线前必须把 `isDemo` 改为 `false`，并替换演示客户和演示交易哈希。

`showcase` 当前展示 `$600.9K × 1% × 30% = 1,802.70 U`，其中上月 `300 U` 明确标记为占位。取得真实付款凭证后，应在 `settlements` 追加正式批次，并删除或替换占位说明；不要直接把占位值改成已付款。

新增客户钱包时，不要把完整钱包地址写入公开 JSON。先生成本地查询哈希：

```bash
npm run wallet:hash -- 0xYourWalletAddress
```

将输出加入客户的 `walletLookupHashes`。EVM 地址会转为小写；Solana 地址保持大小写。

人工结算后：

1. 在 `settlements` 追加新批次，不覆盖旧记录。
2. 写入覆盖周期、链、核算金额、锁价、实付数量和支付时间。
3. 写入真实 `transactionHash` 与 `explorerUrl`。
   同时填写 `paymentChain`；生产数据中已支付批次缺少浏览器链接会校验失败。
4. 更新客户 `settlementStatus`，运行 `npm run validate:data`。
5. 提交并推送，Pages 工作流会自动部署。

## 同步 GMGN 钱包活动

本项目固定兼容 `gmgn-cli@1.5.6`。它同时兼容文档字段 `transaction_hash/type` 与当前实测字段 `tx_hash/event_type`，遍历 `next` 游标后在本地按结算周期截取、去重并聚合。

```bash
npm install --global gmgn-cli@1.5.6
gmgn-cli config --check
```

若尚未配置，按 CLI 提示执行 `gmgn-cli config` 和 `gmgn-cli config --apply <API_KEY>`。查询只需要 `GMGN_API_KEY`，本项目不需要也不保存 GMGN 私钥。GMGN 当前仅支持 IPv4 请求。

以 [`data/private/clients.example.json`](./data/private/clients.example.json) 为模板创建被忽略的 `data/private/clients.json`，确保周期与公开账本一致，然后运行：

```bash
npm run sync:gmgn
npm run check
```

同步器只更新公开的聚合交易量、笔数和快照时间，不发布逐笔活动或完整钱包地址。
跨客户或同一客户的重复钱包配置都会直接失败；未包含在私密配置中的客户/链会被标为“数据延迟”，不会伪装成刚刚完成同步。

仓库还提供手动 GitHub Action `Refresh GMGN observation`。使用前配置：

- `GMGN_API_KEY`：GMGN API Key。
- `GMGN_CLIENTS_JSON`：与 `clients.example.json` 同结构的压缩 JSON。

## 更新推荐入口

[`public/data/referrals.json`](./public/data/referrals.json) 是 VLink 的静态白名单快照。更新时运行：

```bash
npm run sync:referrals
npm run build
```

同步脚本会校验每个目标域名；若 VLink 条目的域名发生变化，脚本会失败，要求人工复核后再发布。推荐页会显示最终目标域名，并为外链添加 `noopener noreferrer sponsored`。
当前目录只收录来源页中的注册、返佣、钱包和支付卡入口；社群、教程及普通文章链接不会发布到推荐页。

OKX 绿色通道是例外：邀请码仍从 VLink 的复制条目读取，免 VPN 域名从 OKX 官方 Notion 素材页的页面标题读取。标题必须包含唯一的 `/join/渠道号` 模板；正文 APK 地址与页面历史旧域名不会参与生成。`Refresh referral directory` 工作流每 4 小时核对一次，仅在公开快照发生变化时提交并触发 Pages 部署。

## GitHub Pages

1. 推送到 GitHub 的 `main` 分支。
2. 在仓库 `Settings > Pages > Build and deployment` 中选择 `GitHub Actions`。
3. `Deploy GitHub Pages` 工作流会构建并发布 `dist/`。

Vite 使用相对资源路径，支持项目仓库形式的 Pages 地址。入口为：

- `index.html`：客户返佣查询和公开结算账本。
- `referral.html`：tosky 注册与返佣链接目录。

## 隐私与安全

GitHub Pages 是完全公开的。钱包哈希和匿名编号只能降低直接枚举风险，不构成访问控制；浏览器开发者工具可以下载所有公开 JSON。若客户交易量必须仅本人可见，需要增加带身份认证的后端，不能继续采用纯静态架构。

不要把 `.env`、API Key、GMGN 私钥、客户姓名、聊天账号或完整私密映射提交到仓库。根目录参考截图已通过 `.gitignore` 排除，避免误发布客户信息。
