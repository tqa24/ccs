# Hướng Dẫn Sử Dụng CCS

## Tại Sao Dùng CCS?

**Được xây dựng cho lập trình viên có cả Claude subscription và GLM Coding Plan.**

### Hai Tình Huống Thực Tế

#### 1. Chọn Model Phù Hợp Với Tác Vụ

**Claude Sonnet 4.5** xuất sắc trong:
- Quyết định kiến trúc phức tạp
- Thiết kế hệ thống và lập kế hoạch
- Gỡ lỗi các vấn đề khó
- Review code cần suy luận sâu

**GLM 4.6** hoạt động tốt cho:
- Sửa lỗi đơn giản
- Triển khai thẳng thắn
- Refactoring hàng ngày
- Viết tài liệu

**Với CCS**: Chuyển model dựa trên độ phức tạp của tác vụ, tối đa hóa chất lượng trong khi quản lý chi phí.

```bash
ccs           # Lên kế hoạch kiến trúc tính năng mới
# Đã có kế hoạch? Triển khai với GLM:
ccs glm       # Viết code đơn giản
```

#### 2. Quản Lý Rate Limit

Nếu bạn có cả Claude subscription và GLM Coding Plan, bạn biết sự khó khăn:
- Claude hết rate limit giữa chừng dự án
- Bạn phải copy thủ công config GLM vào `~/.claude/settings.json`
- 5 phút sau, cần chuyển lại
- Lặp lại 10 lần mỗi ngày

**CCS giải quyết điều này**:
- Một lệnh để chuyển: `ccs` (mặc định) hoặc `ccs glm` (fallback)
- Lưu cả hai config dạng profiles
- Chuyển trong <1 giây
- Không phải sửa file, không copy-paste, không sai sót

### Tính Năng

- Chuyển profile tức thì (Claude ↔ GLM)
- Chuyển tất cả args của Claude CLI
- Cài đặt thông minh: phát hiện provider hiện tại của bạn
- Tự động tạo configs khi cài đặt
- Không proxy, không magic—chỉ bash + jq

## Sử Dụng Cơ Bản

### Chuyển Profiles

```bash
# Hoạt động trên macOS, Linux, và Windows
ccs           # Dùng Claude subscription (mặc định)
ccs glm       # Dùng GLM fallback
```

**Lưu ý Windows**: Lệnh hoạt động giống nhau trong PowerShell, CMD, và Git Bash.

### Với Arguments

Tất cả args sau tên profile được chuyển trực tiếp cho Claude CLI:

```bash
ccs glm --verbose
ccs /plan "add feature"
ccs glm /code "implement feature"
```

### Lệnh Tiện Ích

```bash
ccs --version    # Hiển thị thông tin phiên bản nâng cao với chi tiết cài đặt
ccs --help       # Hiển thị tài liệu trợ giúp riêng của CCS
```

**Ví Dụ Output `--version`**:
```
CCS (Claude Code Switch) v2.4.4

Installation:
  Location: /home/user/.local/bin/ccs -> /home/user/.ccs/ccs
  Config: ~/.ccs/config.json

Documentation: https://github.com/kaitranntt/ccs
License: MIT

Run 'ccs --help' for usage information
```

**Tính Năng Nâng Cứa `--help`**:
- Tài liệu riêng của CCS (không còn delegate cho Claude CLI)
- Ví dụ sử dụng và mô tả flag đầy đủ
- Hướng dẫn cài đặt và gỡ bỏ
- Hướng dẫn cụ thể theo nền tảng
- Vị trí file cấu hình và khắc phục sự cố

**Gỡ Cài Đặt Chính Thức (Khuyến Nghị)**:
```bash
# macOS/Linux
curl -fsSL ccs.kaitran.ca/uninstall | bash

# Windows PowerShell
irm ccs.kaitran.ca/uninstall | iex
```

Uninstaller chính thức gỡ bỏ hoàn toàn CCS bao gồm cả cấu hình và PATH modifications.

### Cài Đặt Commands và Skills

### 🚧 Tính Năng Đang Phát Triển

#### Tích hợp .claude/

Delegation tác vụ qua flags `--install` / `--uninstall` đang được phát triển.

**Trạng Thái**: Testing chưa hoàn tất, không có sẵn trong release hiện tại

**Implementation**: Chức năng cốt lõi đã có nhưng bị vô hiệu hóa pending testing

**Timeline**: Chưa có ETA - theo dõi GitHub issues để cập nhật

**Hiện Tại**: Sử dụng chuyển profile trực tiếp (`ccs glm`) để lựa chọn model

**Ví Dụ Output**:
```
┌─ Installing CCS Commands & Skills
│  Source: /path/to/ccs/.claude
│  Target: /home/user/.claude
│
│  Installing commands...
│  │  [OK]  Installed command: ccs.md
│
│  Installing skills...
│  │  [OK]  Installed skill: ccs-delegation
└─

[OK] Installation complete!
  Installed: 2 items
  Skipped: 0 items (already exist)

You can now use the /ccs command in Claude CLI for task delegation.
Example: /ccs glm /plan 'add user authentication'
```

**Lưu ý**:
- Output dùng ký hiệu ASCII ([OK], [i], [X]) thay vì emoji
- Output có màu trên terminal TTY (tắt với `NO_COLOR=1`)
- File đã tồn tại tự động bỏ qua (an toàn khi chạy lại)

## Delegation Tác Vụ

**CCS bao gồm delegation tác vụ thông minh** qua meta-command `/ccs`:

```bash
# Delegation lập kế hoạch cho GLM (tiết kiệm tokens Sonnet)
/ccs glm /plan "add user authentication"

# Delegation coding cho GLM
/ccs glm /code "implement auth endpoints"

# Câu hỏi nhanh với Haiku
/ccs haiku /ask "explain this error"
```

**Lợi ích**:
- ✅ Tiết kiệm tokens bằng cách delegation tác vụ đơn giản cho model rẻ hơn
- ✅ Dùng đúng model cho từng tác vụ tự động
- ✅ Lệnh có thể tái sử dụng trên tất cả dự án (user-scope)
- ✅ Tích hợp liền mạch với workflows hiện có

## Workflow Thực Tế

### Chọn Model Dựa Trên Tác Vụ

**Tình huống**: Xây dựng tính năng tích hợp thanh toán mới

```bash
# Bước 1: Kiến trúc & Lập kế hoạch (cần trí tuệ của Claude)
ccs
/plan "Design payment integration with Stripe, handle webhooks, errors, retries"
# → Claude Sonnet 4.5 suy nghĩ sâu về edge cases, bảo mật, kiến trúc

# Bước 2: Triển khai (coding đơn giản, dùng GLM)
ccs glm
/code "implement the payment webhook handler from the plan"
# → GLM 4.6 viết code hiệu quả, tiết kiệm usage của Claude

# Bước 3: Code Review (cần phân tích sâu)
ccs
/review "check the payment handler for security issues"
# → Claude Sonnet 4.5 phát hiện các lỗ hổng tinh vi

# Bước 4: Sửa Lỗi (đơn giản)
ccs glm
/fix "update error message formatting"
# → GLM 4.6 xử lý các sửa lỗi hàng ngày
```

**Kết quả**: Model tốt nhất cho từng tác vụ, chi phí thấp hơn, chất lượng tốt hơn.

### Quản Lý Rate Limit

```bash
# Làm việc với refactoring phức tạp bằng Claude
ccs
/plan "refactor authentication system"

# Claude hết rate limit giữa chừng tác vụ
# → Error: Rate limit exceeded

# Chuyển sang GLM ngay lập tức
ccs glm
# Tiếp tục làm việc không gián đoạn

# Rate limit reset? Chuyển lại
ccs
```

## Cách Hoạt Động

1. Đọc tên profile (mặc định là "default" nếu bỏ qua)
2. Tìm đường dẫn file settings trong `~/.ccs/config.json`
3. Thực thi `claude --settings <path> [remaining-args]`

Không có magic. Không sửa file. Chuyển giao thuần túy. Hoạt động giống nhau trên tất cả nền tảng.