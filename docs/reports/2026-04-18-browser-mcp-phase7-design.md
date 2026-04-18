# Browser MCP Phase 7 Design

Last Updated: 2026-04-18

## Goal

在新的 `feat/browser-mcp-hover-phase7` worktree 中，为 CCS-managed `ccs-browser` MCP runtime 设计 Browser MCP Phase 7。
本阶段延续 Phase 6 的 network interception 路线，优先聚焦 **richer request matching**，让现有拦截规则可以按更细的请求特征命中，同时保持既有最小增量策略。

## Scope Summary

### In Scope

- 在现有 `browser_add_intercept_rule` 基础上扩展更丰富的匹配条件
- 新增最小匹配维度：
  - `resourceType`
  - `urlPattern` 或 `urlRegex`（二选一）
  - `headerMatchers`
  - `priority`
- 将规则匹配顺序从“创建顺序”扩展为：
  1. `priority` 从高到低
  2. 同优先级按创建顺序
- 扩展 `browser_list_intercept_rules` 输出，展示新增匹配摘要
- 保持 `browser_list_requests` 为请求摘要视图，不输出 request/response body
- 保持 selected page 解析语义、规则绑定具体 `pageId`、session-local runtime state、页级 websocket interception session 与 `messageQueue` 串行语义

### Explicitly Out of Scope

- 跨页共享规则或浏览器级全局规则
- 下载接受/拒绝控制与下载文件管理
- 请求体匹配
- 响应阶段匹配
- 更复杂布尔逻辑（如任意/全部组、嵌套条件、否定条件）
- 完整网络代理层

## Why Phase 7 Follows Phase 6

Phase 6 已建立：

- page-bound 的 interception rule 管理面
- session-local `interceptRules` / `recentRequests` / `interceptSessionsByPageId`
- `continue` / `fail` / `fulfill` 三种最小动作集

历史设计里也已明确把以下能力延后到后续阶段：

- 更复杂的匹配条件，如 `resourceType`、`headerMatchers`、正则、优先级
- 跨页共享规则
- 下载接受控制

因此，Phase 7 继续沿 network interception 主线推进 richer matching，是与现有实现最连续、收益最大的下一阶段；它能显著提升规则可用性，同时不会把作用域和下载控制这两类新问题混进同一期。

## Architecture

Phase 7 继续沿用 `lib/mcp/ccs-browser-server.cjs` 的单 runtime 架构，不引入新的 browser runtime，也不改写 Phase 5 的 selected page 模型和 Phase 6 的 interception session 生命周期。

本阶段仍沿用三层结构：

1. **Tool surface**：复用现有四个 interception 相关工具，只扩展参数与输出摘要
2. **Session-local state**：继续复用 `interceptRules`、`recentRequests`、`interceptSessionsByPageId`
3. **Page interception session**：继续由具体 page target 的 websocket 消费 paused requests，并根据 richer matching 结果执行动作

关键设计约束：

- 规则仍在创建时解析并固化为具体 `pageId`
- 规则不会在后续 selected page 切换时自动漂移
- 新增 richer matching 不改变现有 action 执行路径，只改变“哪条规则命中”
- `messageQueue` 继续只负责工具入口串行语义；页级 websocket 仍异步接收 paused request 事件

## Tool Surface

Phase 7 不新增新工具，继续复用：

- `browser_add_intercept_rule`
- `browser_remove_intercept_rule`
- `browser_list_intercept_rules`
- `browser_list_requests`

### `browser_add_intercept_rule`

在 Phase 6 参数基础上，扩展最小 richer matching 参数：

- `pageIndex?: number`
- `pageId?: string`
- `urlIncludes?: string`
- `method?: string`
- `resourceType?: string`
- `urlPattern?: string`
- `urlRegex?: string`
- `headerMatchers?: Array<{ name: string; valueIncludes?: string; valueRegex?: string }>`
- `priority?: number`
- `action: "continue" | "fail" | "fulfill"`
- `statusCode?`, `contentType?`, `responseHeaders?`, `body?`（仅 `action: "fulfill"` 时沿用 Phase 6B 现有语义；避免与请求匹配用的 `headerMatchers` 混淆）

约束：

- `pageIndex` 与 `pageId` 不能同时传
- `urlPattern` 与 `urlRegex` 不能同时传
- `priority` 默认 `0`
- `priority` 必须是整数
- header matcher 的 `name` 必填
- 每个 header matcher 至少需要一个值条件：`valueIncludes` 或 `valueRegex`
- Phase 7 仍要求至少有一个请求匹配条件，避免创建“无条件全匹配”规则

### `browser_remove_intercept_rule`

保持不变，仅按 `ruleId` 删除对应规则。

### `browser_list_intercept_rules`

在现有输出基础上，新增简洁摘要字段：

- `priority`
- `resourceType`
- `urlPattern` 或 `urlRegex`
- `headerMatchers` 条件数量或简写摘要

要求：

- 仍保持文本摘要可读性
- 不直接把长正则或大量 header 条件原样完整展开到难以阅读

### `browser_list_requests`

保持“近期请求摘要”定位，不展示 request/response body。

可选补充字段：

- `matchedRuleId`
- `action`
- `statusCode`（仅 fulfill）
- 必要时增加一个轻量命中说明，如 `matchedBy`，只表示命中依赖了哪类条件，不重复整条规则

## State Model

Phase 7 仍复用 Phase 6 的三块 session-local 状态。

### `interceptRules`

每条规则在 Phase 6 基础上新增：

- `resourceType`
- `urlPattern`
- `urlRegex`
- `headerMatchers`
- `priority`

关键约束：

- 规则绑定到创建时解析出的具体 `pageId`
- 规则仍不持久化到磁盘
- `priority` 仅影响匹配顺序，不影响工具展示或生命周期清理逻辑

### `recentRequests`

仍然只存储近期请求摘要，继续不保留 body。

如增加 `matchedBy`，也只记录轻量摘要，而不是完整匹配细节。

### `interceptSessionsByPageId`

不新增新的 session 级状态表。

Phase 7 只扩匹配逻辑，不改 websocket 生命周期模型：

- 规则创建时按需建立 session
- 页面关闭或无规则时回收 session
- websocket 断开时继续进行现有清理与错误恢复语义

## Matching Model

### Matching Order

对某个 paused request，只在其所属 `pageId` 的规则集合内匹配。

匹配顺序：

1. `priority` 从高到低
2. 同优先级按创建顺序
3. 第一条完整命中的规则生效

这意味着 Phase 7 解决了 Phase 6 “只能按创建顺序命中”的限制，同时避免引入更复杂的规则编排系统。

### Rule Predicate Evaluation

每条规则依次检查：

1. `method`
2. `urlIncludes`
3. `urlPattern` 或 `urlRegex`
4. `resourceType`
5. `headerMatchers`

所有已提供条件都必须命中，规则才算匹配成功。

### Header Matching

Phase 7 的 header matching 采用最小规则：

- header 名称按大小写不敏感匹配
- 每个 matcher 至少要求一个值条件：
  - `valueIncludes`
  - `valueRegex`
- 多个 header matcher 之间采用“全部满足”语义

Phase 7 不支持：

- any/all 模式切换
- header 多值数组高级语义
- 负向匹配
- body/JSON 级内容匹配

## Data Flow

### Add Rule Flow

1. `browser_add_intercept_rule` 解析目标页
2. 校验 richer matching 参数
3. 生成 `ruleId`
4. 将规则写入 `interceptRules`
5. 为目标页创建或复用 interception session
6. 返回包含新增匹配摘要的 rule 文本

### Request Match Flow

1. 页级 interception session 收到 paused request 事件
2. 取出该页全部有效规则
3. 按 `priority DESC + createdAt ASC` 排序
4. 逐条检查 method / URL / resourceType / `headerMatchers` 条件
5. 第一条命中规则决定 action：
   - `continue`
   - `fail`
   - `fulfill`
6. 将结果写入 `recentRequests`
7. 若无任何规则命中，则默认 `continue`

### Remove Rule Flow

保持 Phase 6 行为：

1. `browser_remove_intercept_rule` 按 `ruleId` 找到规则
2. 从 `interceptRules` 删除
3. 若该页已无剩余规则，则关闭该页 interception session
4. 返回删除结果

## Error Handling and Boundary Rules

### Parameter Rules

`browser_add_intercept_rule`：

- `pageIndex` 和 `pageId` 不能同时传
- `urlPattern` 和 `urlRegex` 不能同时传
- `priority` 必须是整数
- `headerMatchers` 必须是数组
- 每个 header matcher 必须有 `name`
- 每个 header matcher 必须至少有 `valueIncludes` 或 `valueRegex`
- 目标页不存在、已关闭或无 websocket target 时直接报错

### Matching Rules

- 不支持空 header matcher
- 不支持空正则
- 不支持通过 richer matching 创建跨页规则
- 同一请求只应用第一条命中的规则

### Lifecycle Rules

- 页面关闭时，绑定该 `pageId` 的规则与近期请求摘要继续按 Phase 6 规则清理
- websocket 关闭时不保留悬挂 session
- selected page 变化不影响已创建规则的 `pageId` 绑定

## Testing Strategy

Phase 7 继续沿用既有 TDD 路线，在 `tests/unit/hooks/ccs-browser-mcp-server.test.ts` 上扩展 deterministic harness 与行为断言。

建议拆分为：

1. **Schema / 参数失败测试**
   - `urlPattern` 与 `urlRegex` 同传时报错
   - `priority` 非整数时报错
   - `headerMatchers` 不是数组时报错
   - header matcher 缺 `name` 报错
   - header matcher 既无 `valueIncludes` 也无 `valueRegex` 报错

2. **主路径测试**
   - `resourceType` 命中
   - `urlPattern` 命中
   - `urlRegex` 命中
   - `headerMatchers.valueIncludes` 命中
   - `headerMatchers.valueRegex` 命中

3. **优先级与回归测试**
   - 更高 `priority` 的规则覆盖较低优先级规则
   - 同优先级仍按创建顺序命中
   - selected page 切换后规则仍绑定原 `pageId`
   - 页面关闭后 richer matching 规则与请求摘要一起清理

4. **仓库验证顺序**
   - focused test
   - `bun run build:server`
   - `bun run format`
   - `bun run validate`
   - `bun run validate:ci-parity`

## Documentation Impact

如果 Phase 7 落地，`docs/browser-automation.md` 需要同步更新：

- Phase 7 capability details
- richer matching 示例
- 当前仍未支持的范围：跨页规则、下载控制、请求体匹配等

## Phase 7 Deliverable Boundary

Phase 7 的交付结果应当是：

- 用户可以继续用现有四个 interception 工具
- 用户可以创建更精细的 page-bound 规则
- 用户可以用 `priority` 控制命中顺序
- 用户仍在同一 session-local interception 模型里工作
- 代码不因为这期而引入新的全局作用域、下载控制或代理层复杂度

这让 Browser MCP 的 network interception 从“最小可用”进入“更稳定可控”，但仍然保持单期可交付范围。
