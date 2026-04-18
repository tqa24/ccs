# Browser MCP Phase 8 Design

Last Updated: 2026-04-19

## Goal

在当前已完成并提交的 Browser MCP Phase 7 基线之上，为 CCS-managed `ccs-browser` MCP runtime 设计 Browser MCP Phase 8。

本阶段延续历史 roadmap 中 Phase 7 预留的 file-transfer / lifecycle completion 方向，但按当前官方 CDP 能力边界做最小修正：

- **下载控制**：采用 session-local、browser-scoped 的下载策略与下载结果摘要
- **最小上传**：采用 page-scoped 的 file input 设置能力

Phase 8 的目标是补齐“文件流转”这一类真实浏览器工作流缺口，让 browser MCP 不再只有页面交互与网络拦截，还能覆盖最常见的下载与表单文件上传场景。

## Why Phase 8 Follows Phase 7

历史 spec 的主路线是：

- Phase 5：page/tab control
- Phase 6：network interception + mock responses
- Phase 7：file-transfer and lifecycle completion
- Phase 8+：recording / replay / higher-level orchestration

后来实际交付里，Phase 6 被拆成 6A / 6B，Phase 7 又继续完成了 richer request matching。因此当前 browser MCP 已经把 interception 线打磨到了一个较完整的最小闭环：

- page-bound interception rules
- session-local state
- `continue` / `fail` / `fulfill`
- richer request matching
- recent request summaries

下一阶段如果继续深挖 interception，会开始落入 request body matching、更复杂 boolean matcher groups、cross-page shared rules 这类更重的规则编排问题；而历史 roadmap 里原本预留的 file transfer 缺口仍未补上。

因此，Phase 8 应该回到原 roadmap，优先补：

- **download handling**
- **minimal upload handling**

这样既尊重了最初路线，也能让 browser MCP 覆盖更多真实 end-to-end workflow。

## Scope Summary

### In Scope

1. **下载控制**
   - 为当前 attach session 设置下载策略：接受或拒绝下载
   - 支持 session-local 下载目录配置
   - 记录近期下载摘要
   - 支持取消进行中的下载
   - 继续兼容现有 `browser_wait_for_event(kind=download)` 事件等待能力

2. **最小上传**
   - 为 `<input type="file">` 设置一个或多个本地文件
   - 支持当前已有 selector 作用域能力：`nth`、`frameSelector`、`pierceShadow`
   - 保持 selected page 解析语义

3. **状态可见性**
   - 通过新的下载列表工具查看近期下载摘要与状态
   - 返回清晰的 upload / download 结果摘要

### Explicitly Out of Scope

- 原生系统文件选择器接管
- drag-and-drop 上传
- 下载文件内容读取、解析或回传
- 上传后自动点击 submit 或自动编排后续页面流程
- 跨 runtime 持久化下载策略或下载记录
- 基于 interception 的下载内容改写
- 录制 / 回放 / 宏编排
- request body matching
- 更复杂 boolean matcher groups
- 跨页共享 interception rules

## CDP Constraint and Scope Correction

Phase 8 的关键设计修正来自当前官方 CDP 能力边界：

### Uploads

上传侧可基于 `DOM.setFileInputFiles` 实现，因此天然适合继续沿用当前 browser MCP 的 page-scoped / selector-scoped 工具模型。

### Downloads

下载侧主要依赖 Browser domain：

- `Browser.setDownloadBehavior`
- `Browser.cancelDownload`
- `Browser.downloadWillBegin`
- `Browser.downloadProgress`

这些接口更接近 **browser-scoped / browser-context-scoped** 能力，而不是某个 page target 独占的 page-bound 能力。因此 Phase 8 不应伪装成“每页独立下载开关”，而应明确采用：

- **下载控制：session-local, browser-scoped**
- **上传控制：page-scoped**

这是一个有意的混合作用域设计，但它与 CDP 现实能力一致，也避免了 misleading 的 page-local 承诺。

## Architecture

Phase 8 继续沿用 `lib/mcp/ccs-browser-server.cjs` 的单 runtime 架构，不引入新的 browser runtime，也不重写 Phase 5 selected page 模型或 Phase 6-7 的 interception 架构。

本阶段分成两条并行但边界清晰的能力线：

1. **Download control line**
   - browser-scoped CDP Browser domain 控制
   - session-local 下载策略与下载摘要
2. **File input upload line**
   - page-scoped selector 解析
   - DOM file input 赋值

### Design Principles

- 下载控制尊重 CDP Browser domain 的真实作用域，不伪造成 page-bound
- 上传继续复用已有 selector / frame / shadow 解析模型，不新建第二套选择器系统
- 继续保持 session-local state，不持久化到磁盘
- 继续保持最小增量策略，不把 download/upload 扩展成完整文件管理系统
- 不为了 Phase 8 重构现有 wait / event / interception 基础设施

## Tool Surface

Phase 8 推荐新增三个工具。

### 1. `browser_set_download_behavior`

为当前 attach session 设置下载策略。

建议参数：

- `behavior: "accept" | "deny"`
- `downloadPath?: string`
- `eventsEnabled?: boolean`

行为：

- `behavior=accept` 时允许下载
- `behavior=deny` 时拒绝下载
- `downloadPath` 仅在 accept 时有效；如省略，则 runtime 选择 session-local 默认下载目录
- `eventsEnabled` 默认开启，保证下载事件和结果摘要可见
- 作用域为当前 attach session / browser context，而不是单个页面

返回字段建议最小包含：

- `scope: browser`
- `behavior`
- `downloadPath`
- `eventsEnabled`
- `status`

### 2. `browser_list_downloads`

列出当前 MCP runtime 记录的近期下载摘要。

建议参数：

- `limit?: number`
- `pageId?: string`

行为：

- 默认返回最近下载摘要
- 可按触发下载时记录的 `pageId` 过滤
- 不读取下载文件内容
- 只返回摘要和状态

返回字段建议最小包含：

- `downloadId`
- `guid`
- `pageId`
- `url`
- `suggestedFilename`
- `status`
- `savedPath`
- `startedAt`
- `finishedAt`

### 3. `browser_cancel_download`

取消进行中的下载。

建议参数：

- `downloadId?: string`
- `guid?: string`

行为：

- 按 runtime 记录的 `downloadId` 或底层 `guid` 定位目标
- 调用 Browser domain cancel 能力
- 更新 `recentDownloads` 中对应项状态

约束：

- `downloadId` 与 `guid` 至少提供一个
- 两者同时提供时必须指向同一条下载记录，否则报错

### 4. `browser_set_file_input`

为 `<input type="file">` 直接设置本地文件。

建议参数：

- `selector: string`
- `files: string[]`
- `pageIndex?: number`
- `pageId?: string`
- `nth?: number`
- `frameSelector?: string`
- `pierceShadow?: boolean`

行为：

- 解析目标页
- 解析 selector 作用域
- 定位目标节点
- 要求目标是 `<input type="file">`
- 将本地文件路径集合设置到该 input
- 返回设置结果摘要

返回字段建议最小包含：

- `pageId`
- `pageIndex`
- `selector`
- `fileCount`
- `status`

## State Model

Phase 8 继续使用 session-local in-memory state。

### `downloadBehaviorState`

存储当前 attach session 的下载行为配置。

建议字段：

- `behavior`
- `downloadPath`
- `eventsEnabled`
- `updatedAt`

关键约束：

- browser-scoped
- 不绑定 pageId
- runtime 重启后丢失

### `recentDownloads`

记录近期下载摘要。

建议字段：

- `downloadId`
- `guid`
- `pageId`
- `url`
- `suggestedFilename`
- `status: "started" | "inProgress" | "completed" | "canceled" | "denied" | "failed"`
- `savedPath`
- `receivedBytes`
- `totalBytes`
- `startedAt`
- `finishedAt`

关键约束：

- 固定上限，建议 100 条
- 只保留摘要，不读文件内容
- 通过 `guid` 关联 Browser domain 下载事件

### Existing selected page state

上传工具继续复用现有 selected page 模型：

- 显式 `pageIndex` 优先
- 否则走 selected page
- stale selected page 时回退到第一可用页面

## Data Flow

### Download behavior update flow

1. `browser_set_download_behavior` 校验参数
2. 若 `behavior=accept` 且未提供 `downloadPath`，计算 session-local 默认下载目录
3. 调用 `Browser.setDownloadBehavior`
4. 更新 `downloadBehaviorState`
5. 返回当前配置摘要

### Download observation flow

1. runtime 接收 `Browser.downloadWillBegin`
2. 生成 `downloadId`
3. 写入 `recentDownloads`，状态为 `started`
4. 记录触发时关联的 `pageId`（若能确定）
5. 若后续收到 `Browser.downloadProgress`：
   - 更新 `receivedBytes` / `totalBytes`
   - 当 state=`completed` 时写入 `finishedAt` 和可用 `savedPath`
   - 当 state=`canceled` 时更新状态

### Download cancel flow

1. `browser_cancel_download` 解析目标记录
2. 调用 `Browser.cancelDownload`
3. 更新 `recentDownloads` 为 `canceled`
4. 返回取消结果摘要

### File input upload flow

1. `browser_set_file_input` 解析目标页
2. 解析 `selector` / `nth` / `frameSelector` / `pierceShadow`
3. 定位 DOM 节点
4. 校验目标是 `<input type="file">`
5. 校验所有本地文件路径存在且为普通文件
6. 调用 `DOM.setFileInputFiles`
7. 返回设置结果摘要

## Error Handling and Boundary Rules

### `browser_set_download_behavior`

- `behavior` 只能是 `accept` 或 `deny`
- `behavior=deny` 时不接受 `downloadPath`
- `downloadPath` 不可写时报错
- Browser domain 下载能力不可用时报错

### `browser_list_downloads`

- `limit` 越界时回退到安全默认值
- `pageId` 不存在时返回空列表，不报错

### `browser_cancel_download`

- `downloadId` 与 `guid` 至少传一个
- 指定下载不存在时报错
- 下载已完成时取消应报明确错误或返回 no-op 状态，但语义必须固定

### `browser_set_file_input`

- `pageIndex` 与 `pageId` 不能同时传
- `selector` 不能为空
- `files` 必须是非空数组
- 文件不存在时报错
- 文件路径不是普通文件时报错
- selector 无匹配时报错
- 多匹配但未提供 `nth` 时应保持与当前 selector 工具一致的目标解析语义
- 命中的元素不是 `<input type="file">` 时报错
- 跨域 iframe 不支持
- closed shadow root 不支持

## Interaction with Existing Capabilities

### With `browser_wait_for_event`

Phase 8 不替换 `browser_wait_for_event(kind=download)`；它继续负责：

- 等待下载开始事件
- 作为轻量事件观察能力存在

Phase 8 新增的下载工具负责：

- 设置下载策略
- 查看下载摘要
- 取消下载

### With selected page semantics

- 下载行为是 browser-scoped，不依赖 selected page
- 上传行为继续遵循 selected page 解析语义
- 这两者的作用域不同是有意设计，不属于不一致 bug

### With interception state

- 下载工具不复用 interception rule 管理面
- 下载记录与 request summaries 是并行状态，不相互嵌套
- 不把 download handling 强行建模成 interception action

## Testing Strategy

Phase 8 继续扩展：

- `tests/unit/hooks/ccs-browser-mcp-server.test.ts`

并在 deterministic harness 上增加最小 download / upload 模拟能力。

### Required download coverage

1. 工具列表与 schema 暴露正确
2. `browser_set_download_behavior` accept 成功
3. `browser_set_download_behavior` deny 成功
4. `behavior=deny` + `downloadPath` 报错
5. 下载开始后 `browser_list_downloads` 能看到 started 摘要
6. 下载完成后能看到 completed 状态与文件路径
7. 下载取消后能看到 canceled 状态
8. `browser_wait_for_event(kind=download)` 继续兼容
9. `limit` 和 `pageId` 过滤生效

### Required upload coverage

1. 单文件上传成功
2. 多文件上传成功
3. selector 无匹配失败
4. 命中的不是 file input 失败
5. 文件不存在失败
6. `frameSelector` 作用域成功
7. `pierceShadow` 作用域成功
8. 省略 `pageIndex/pageId` 时命中当前 selected page
9. 显式 `pageIndex` 仍覆盖 selected page

### Repository validation order

继续遵循该区域已稳定使用的验证顺序：

1. focused browser MCP unit tests
2. `bun run build:server`
3. `bun run format`
4. `bun run validate`
5. `bun run validate:ci-parity`

## Documentation Impact

如果 Phase 8 实现落地，至少需要同步：

- `docs/browser-automation.md`

需要新增：

- Phase 8 capability details
- 下载控制与上传示例
- browser-scoped downloads / page-scoped uploads 的作用域说明
- 新的 out-of-scope 边界说明

## Worktree Requirement

后续实现不应继续直接在当前 Phase 7 worktree 上混写。

推荐隔离方式：

1. 保留 `feat/browser-mcp-hover-phase7` 作为已完成 checkpoint
2. 基于其已验证提交创建新的 Phase 8 worktree
3. 在新 worktree 中完成 Phase 8 plan 与实现

## Success Criteria

Phase 8 成功的标志是：

1. 用户可以显式控制当前 attach session 的下载接受/拒绝行为
2. 用户可以查看近期下载摘要并取消进行中的下载
3. 用户可以向 `<input type="file">` 设置本地文件
4. 下载与上传能力都遵循清晰、真实的作用域语义
5. 本期不引入 drag-and-drop、原生文件选择器接管、内容读取或 orchestration 复杂度

这使 Browser MCP 在当前阶段从“页面交互 + 网络拦截”扩展到“最小文件流转闭环”，为后续更高阶的录制、回放和 workflow orchestration 打下更完整的基础。
