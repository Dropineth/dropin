# 场景与隔离预览前置条件调查

调查时间：2026-09-30（UTC）。本阶段工作树起点：`8ba02a3e7fe591b115162229510112220b4182b8`。

结论：**两个真实场景继续停用站内嵌入；受保护的外部 staging 仍未具备本候选可用的完整输入。** 本次只读取来源响应头、仓库文件和 GitHub 元数据，并写入本报告及观察文件。未修改应用、CI 或 package；未 commit/push、标记/合并 PR、触发工作流、审批部署、创建资源、改变 DNS、建立隧道或读取 secret 值。

## 真实场景：本次有限观察

使用现有 `node dropin-earth/scripts/lifepp-scene-check.mjs`，只对固定 allowlist 原始地址发送 HEAD；每次请求超时 5 秒，响应头上限 16 KiB，至多两次且仍须命中固定列表的手动重定向。不读取响应正文、模型、纹理、视频或受限 API，不猜测 HTTPS，也不替换原始 URL。

| 场景 | 原始输入 | 本次实际观察 | 不能据此认定的事项 |
| --- | --- | --- | --- |
| 31 | `http://kjlying.com:8456/scenes/31` | 02:45:52.003Z 返回 **HTTP 200**；`content-type: text/html; charset=utf-8`，`content-length: 948`；未发生已观察重定向 | 未读取 HTML 正文；不证明三维资产存在、引擎可运行、HTTPS 可用或拥有展示/嵌入许可 |
| 29 | `http://kjlying.com:8456/scenes/29` | 02:45:53.349Z 返回 `ECONNRESET`，`socket hang up`；无状态码/响应头 | 当前访问失败不证明来源全局离线，也不构成绕过限制的理由 |

完整返回结果保存在 [scene-head-observations.json](scene-head-observations.json)。较初轮两个来源均连接失败的观察，**31 的本次 HTTP 头响应可达性发生变化**；旧报告保留为旧时点证据，不覆盖或改写。

本次查看用户任务文件、随附 `site-manifest.json` 与仓库场景报告。它们仍只提供“用户描述的 3D 高斯测试输入”，没有附带提供方确认的 HTTPS 地址、权利文件或引擎握手说明。此结论限于这些已提供材料，不是对所有公开网页的穷尽检索，也没有主动联系提供方。采集方、地点、采集日期、资产格式/版本与真实缩略图仍为 `null`，不得从编号或 HTTP 200 补造。

| 启用条件 | 场景 31 | 场景 29 | 下一项所需证据 |
| --- | --- | --- | --- |
| 经提供方确认、实际可用的 HTTPS 嵌入地址 | 缺失 | 缺失 | 提供方明确的新地址，原 `sourceUrl` 保留 |
| 展示及嵌入许可 | 待确认 | 待确认 | 可归属到权利方、场景和用途的许可记录 |
| 所有重定向、子资源及 TLS 安全 | 未核验 | 未核验 | 获准 HTTPS 集成后的实际检查；本次 HEAD 不读取子资源 |
| 提供方 `frame-ancestors` / `X-Frame-Options` 允许 | 本次 HEAD 未观察到这两类头；**不是许可证据** | 无响应头 | 对实际 HTTPS 来源和重定向链的策略确认 |
| 本方精确 `frame-src` 允许 | 当前仍为 `frame-src 'none'` | 同左 | 独立审阅后的精确策略变更，不使用通配或代理绕过 |
| 可信引擎就绪与真实浏览器验收 | 未完成 | 未完成 | 对实际来源的 origin/source/schema 校验与真实运行证据；iframe onLoad 不够 |
| 导航、检索、下载、训练、再分发、商业结算许可 | 未授予/未核验 | 同左 | 每个用途独立授权；展示许可不自动扩展 |

`APPROVED_SCENE_EMBEDS` 仍为空。既有 8 项浏览器适配器测试是 **FIXTURE ONLY**：测试 bundle 临时替换许可记录，保留域名上的响应由 Playwright 模拟，GPU 能力也被模拟。它们验证查看器生命周期，不能作为上述任一真实来源的授权、模型渲染或导航验收证据。本次没有重新执行这些测试或启用查看器。

## PR #3 与已有 staging 路径

02:48:29Z 发起的普通 GitHub REST 读取成功确认 [PR #3](https://github.com/Dropineth/dropin/pull/3)：

- 标题：`chore(canopyproof): add protected staging deployment control plane`。
- `state: open`，`draft: false`，`merged_at: null`，labels 为空。
- head：`canopyproof/staging-control-plane`，SHA `2dfc98d4af18d33bcd3e91403aa2777d61aea2f6`。
- 返回的 `base.sha: 15025bc03456d605f1ccbd529a8d66b0f1f8d3f8` 是 **PR 关联元数据**，不能等同于实时 `refs/heads/main`。本次不据此推断 main 发生变化；实时 main 由主任务另外执行 git/ref 查询核验。

PR #3 仍作为独立审查事项保留，本调查没有借用其 secret-bearing 执行路径。

对 `main` 上 staging workflow 文件的 Contents API 读取返回 Git blob SHA `0742460bb862e86beb8ac4f4f36c7b1da079af73`、大小 11646 字节；本地 `.github/workflows/deploy-canopyproof-staging.yml` 的 `git hash-object` 返回相同 SHA。因此可以把本地读取的以下流程限制归属到这次确认的远程文件版本：

- 同仓 PR 必须通过 `canopyproof-staging` 标签事件触发，并绑定 PR head SHA。
- 手动 dispatch 的 target SHA 必须等于 `canopyproof/industrial-rc1` 分支尖端，且传入摘要等于保护环境值；不能拿当前 Life++ 分支直接替代该要求。
- 使用 `canopyproof-staging` 保护环境；先验证资源清单，再 checkout 并核对目标 SHA，然后运行既有 CI、数据库、覆盖率、浏览器和 workerd 门槛。
- 预期部署独立的 web/API staging Workers，保留生产资金、机器人等功能关闭状态及生产路由隔离。

Actions workflow 状态列表、workflow 元数据和运行列表查询未取得有效返回，错误原样为相应 URL 的 `Get "https://api.github.com/...": EOF`。文件存在不等于 workflow 当前启用或最近运行成功。GitHub staging deployments 查询成功返回 `[]`；这仅表示本次查询未见该环境的 GitHub Deployment 记录，不证明 Cloudflare 上不存在手动建立的资源。原始错误与有效响应的限定字段见 [github-preview-metadata.json](github-preview-metadata.json)。

## 当前保护配置和资源输入缺口

| 项目 | 本次实际元数据 | 结论 / 所需输入 |
| --- | --- | --- |
| staging 环境 | `canopyproof-staging` 存在 | 环境名称已确认，不代表资源就绪 |
| staging 必需审批人 | `Dropineth` / `xiruier`；`prevent_self_review: true` | 审批机制已确认；没有本候选部署的已授予审批证据 |
| production 必需审批人 | `poccahin` / `Dropineth`；`prevent_self_review: true` | 保持独立生产审批；不等于 staging 放行 |
| staging 分支策略 | `custom_branch_policies: true`；唯一分支规则 `main` | PR 事件的 merge ref 不匹配该唯一规则，见下述依据；不得自行扩展或规避规则 |
| 管理员能否绕过环境保护 | 未取得明确返回 | runbook 要求正常操作不得绕过；不能把未知标为已禁用 |
| `CANOPYPROOF_STAGING_RESOURCE_MANIFEST_SHA256` | staging Environment variables **0 项**；repo Actions variables **0 项**；仓库 owner 类型为 User | 该必需摘要未在这两层配置。当前源码从 `vars` 取值；没有它不能通过资源预检 |
| staging 环境 secret 名称 | 仅 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN` 两项 | 只知道名称存在；未读取值，未验证账号归属、token 权限或有效性 |
| `CANOPYPROOF_STAGING_API_ORIGIN` | 不在 staging 环境 secret 名称清单；repo secret 名称查询 EOF | 环境层未按 runbook 配置；repo 回退是否存在尚不明，不能声称绝对缺失或可用 |
| `CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON` | 不在 staging 环境 secret 名称清单；repo secret 名称查询 EOF | 同上；无已核验资源清单及其精确 UTF-8 摘要 |
| 独立 HTTPS API、隔离 PostgreSQL、隔离对象存储 | 没有可归属到本候选且获授权的资源清单与实际检查结果 | 不能推断已创建、为空、已隔离或可供本候选使用 |
| API 与生产来源比较值 | repo secret 名称查询未成功；未读取任何值 | 无法确认比较条件当前完整 |
| 本候选实际外部预览地址、部署版本、smoke | 没有已返回的有效证据 | 不能交付或宣称外部预览已部署；保留本地隔离预览 |

GitHub 官方文档说明，环境分支限制对 workflow 的 `GITHUB_REF` 匹配，PR 事件通常需要对应 merge-ref 规则。**据官方规则与本次仅有 `main` 的配置推断，已有 PR 标签触发路径目前不能直接满足该环境分支门槛。** 这不是增加标签后实际尝试部署的结果，也不建议放宽成任意分支。[GitHub 环境部署分支规则](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#deployment-branches-and-tags)

另有需要维护者确认的既有文档差异：staging runbook 要求与 production 相同的独立 reviewer 集合，而本次两者集合并不相同；两者均已启用禁止自审。不得由本任务自动改 reviewer 或解释为已获例外批准。

## 可推进与必须保留的边界

可以继续本地代码、完整 CI 和隔离的 loopback 验证；这些工作不依赖第三方场景或远程部署授权。外部预览需要维护者通过已批准的受保护路径确认候选、补齐隔离资源及摘要、明确分支/审批适用性并取得独立审核；本报告不授予这些动作权限，不创建任何资源，也不建议借用 PR #3、个人密钥、临时隧道或生产配置。所有场景集成许可与真实浏览器验收须单独取得，HTTP 200 不能替代任何授权条件。
