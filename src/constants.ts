/**
 * Constants and preset definitions for the FLOW plugin.
 *
 * All presets use numbered prefix format ("1. Capture") matching the
 * official FLOW vault structure.
 */

import { FlowPluginSettings, FlowPreset, FlowRole, FLOW_ROLE_ORDER, FlowFolderMap } from "./types";

export const VIEW_TYPE_TASK_SIDEBAR = "flow-task-sidebar-view";

// ── Presets ──────────────────────────────────────────────────────────────

export const FLOW_PRESETS: FlowPreset[] = [
	{
		id: "default",
		label: "Default (FLOW)",
		folders: {
			[FlowRole.CAPTURE]: "1. Capture",
			[FlowRole.TRACK]: "2. Track",
			[FlowRole.FORGE]: "3. Forge",
			[FlowRole.BLUEPRINT]: "4. Blueprint",
			[FlowRole.EXHIBIT]: "5. Exhibit",
			[FlowRole.VAULT]: "6. Vault",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Nắm bắt nhanh mọi ý tưởng, thông tin chưa phân loại.",
			[FlowRole.TRACK]: "Theo dõi nhật ký, thói quen và các nhiệm vụ định kỳ.",
			[FlowRole.FORGE]: "Xử lý, kết nối và phát triển kiến thức đang hình thành.",
			[FlowRole.BLUEPRINT]: "Hệ thống hóa kiến thức cốt lõi và các khung tư duy.",
			[FlowRole.EXHIBIT]: "Trình bày các sản phẩm hoàn thiện sẵn sàng công bố.",
			[FlowRole.VAULT]: "Kho lưu trữ vĩnh viễn cho những giá trị đã đóng gói.",
		},
	},
	// ── Usage-Based Presets ──────────────────────────────────────────
	{
		id: "growth",
		label: "Growth (Tư duy & Phát triển)",
		folders: {
			[FlowRole.CAPTURE]: "1. Note",
			[FlowRole.TRACK]: "2. Habit",
			[FlowRole.FORGE]: "3. Journal",
			[FlowRole.BLUEPRINT]: "4. Vision",
			[FlowRole.EXHIBIT]: "5. Win",
			[FlowRole.VAULT]: "6. Archive",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Gieo mầm những ý tưởng và suy nghĩ mới chớm nở.",
			[FlowRole.TRACK]: "Nuôi dưỡng thói quen và nhịp sống kỷ luật hàng ngày.",
			[FlowRole.FORGE]: "Dòng chảy tư duy và quá trình tự nhận thức bản thân.",
			[FlowRole.BLUEPRINT]: "Tầm nhìn cuộc đời và các bản đồ định hướng tương lai.",
			[FlowRole.EXHIBIT]: "Những viên ngọc quý về bài học và thành tựu cá nhân.",
			[FlowRole.VAULT]: "Nơi lưu giữ hành trình trưởng thành theo thời gian.",
		},
	},
	{
		id: "content",
		label: "Creative (Sáng tạo nội dung)",
		folders: {
			[FlowRole.CAPTURE]: "1. Idea",
			[FlowRole.TRACK]: "2. Plan",
			[FlowRole.FORGE]: "3. Draft",
			[FlowRole.BLUEPRINT]: "4. Asset",
			[FlowRole.EXHIBIT]: "5. Publish",
			[FlowRole.VAULT]: "6. Library",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Nơi lưu giữ những tia sáng cảm hứng bất chợt.",
			[FlowRole.TRACK]: "Quản lý dòng chảy sản xuất và lịch biên tập.",
			[FlowRole.FORGE]: "Mài giũa các bản thảo thành tác phẩm hoàn chỉnh.",
			[FlowRole.BLUEPRINT]: "Xây dựng chất liệu, bối cảnh và hệ thống ý tưởng.",
			[FlowRole.EXHIBIT]: "Cổng trình bày các tác phẩm đã sẵn sàng ra mắt.",
			[FlowRole.VAULT]: "Thư viện tư liệu và kho lưu trữ các dự án cũ.",
		},
	},
	{
		id: "project",
		label: "Project (Quản lý dự án)",
		folders: {
			[FlowRole.CAPTURE]: "1. Inbox",
			[FlowRole.TRACK]: "2. Task",
			[FlowRole.FORGE]: "3. Work",
			[FlowRole.BLUEPRINT]: "4. Plan",
			[FlowRole.EXHIBIT]: "5. Ship",
			[FlowRole.VAULT]: "6. Archive",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Tiếp nhận mọi yêu cầu và thông tin đầu vào dự án.",
			[FlowRole.TRACK]: "Theo dõi danh sách công việc và thời hạn quan trọng.",
			[FlowRole.FORGE]: "Nơi thực hiện các tác vụ chuyên môn và xử lý chi tiết.",
			[FlowRole.BLUEPRINT]: "Kế hoạch chiến lược, sơ đồ và cấu trúc dự án.",
			[FlowRole.EXHIBIT]: "Bàn giao sản phẩm và kết quả đầu ra của dự án.",
			[FlowRole.VAULT]: "Kho tài nguyên, mẫu (templates) và hồ sơ dự án.",
		},
	},
	{
		id: "learning",
		label: "Learning (Học tập & Nghiên cứu)",
		folders: {
			[FlowRole.CAPTURE]: "1. Source",
			[FlowRole.TRACK]: "2. Review",
			[FlowRole.FORGE]: "3. Learn",
			[FlowRole.BLUEPRINT]: "4. Map",
			[FlowRole.EXHIBIT]: "5. Output",
			[FlowRole.VAULT]: "6. Archive",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Nguồn học liệu thô, tài liệu đọc và tham khảo.",
			[FlowRole.TRACK]: "Lộ trình học tập và theo dõi tiến độ khóa học.",
			[FlowRole.FORGE]: "Tổng hợp kiến thức và kết nối các khái niệm mới.",
			[FlowRole.BLUEPRINT]: "Bản đồ tư duy và hệ thống khung kiến thức cốt lõi.",
			[FlowRole.EXHIBIT]: "Ghi chú tinh gọn và các bài viết đúc kết sâu sắc.",
			[FlowRole.VAULT]: "Kho lưu trữ vĩnh viễn các tài liệu tham khảo giá trị.",
		},
	},
	// ── Persona-Based Presets ────────────────────────────────────────
	{
		id: "knowledge_worker",
		label: "Persona: Knowledge Worker",
		folders: {
			[FlowRole.CAPTURE]: "1. Inbox",
			[FlowRole.TRACK]: "2. Focus",
			[FlowRole.FORGE]: "3. Craft",
			[FlowRole.BLUEPRINT]: "4. Pillars",
			[FlowRole.EXHIBIT]: "5. Port",
			[FlowRole.VAULT]: "6. Archive",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Hòm thư cho mọi thông tin và tài liệu mới thu thập.",
			[FlowRole.TRACK]: "Quản lý sự tập trung và tiến độ công việc hàng ngày.",
			[FlowRole.FORGE]: "Nơi nhào nặn ý tưởng thành các sản phẩm chất lượng.",
			[FlowRole.BLUEPRINT]: "Xây dựng các cột trụ kiến thức và chuyên môn sâu.",
			[FlowRole.EXHIBIT]: "Cổng xuất bản các báo cáo, bài viết và dự án hoàn tất.",
			[FlowRole.VAULT]: "Nơi lưu giữ các nguồn lực và tư liệu quý giá dài hạn.",
		},
	},
	{
		id: "software_engineer",
		label: "Persona: Software Engineer",
		folders: {
			[FlowRole.CAPTURE]: "1. Backlog",
			[FlowRole.TRACK]: "2. Sprint",
			[FlowRole.FORGE]: "3. Code",
			[FlowRole.BLUEPRINT]: "4. Arch",
			[FlowRole.EXHIBIT]: "5. Docs",
			[FlowRole.VAULT]: "6. Legacy",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Lưu trữ nhanh các lỗi (bugs), ý tưởng tính năng mới.",
			[FlowRole.TRACK]: "Theo dõi tiến độ Sprint và các ticket đang xử lý.",
			[FlowRole.FORGE]: "Rèn luyện tư duy lập trình và viết mã nháp.",
			[FlowRole.BLUEPRINT]: "Kiến trúc hệ thống, sơ đồ và các quyết định thiết kế.",
			[FlowRole.EXHIBIT]: "Tài liệu kỹ thuật và hướng dẫn sử dụng sản phẩm.",
			[FlowRole.VAULT]: "Di sản mã nguồn và các dự án đã hoàn thành.",
		},
	},
	{
		id: "trader",
		label: "Persona: Trader",
		folders: {
			[FlowRole.CAPTURE]: "1. Signal",
			[FlowRole.TRACK]: "2. Trade",
			[FlowRole.FORGE]: "3. Edge",
			[FlowRole.BLUEPRINT]: "4. System",
			[FlowRole.EXHIBIT]: "5. Log",
			[FlowRole.VAULT]: "6. History",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Ghi lại các tín hiệu thị trường và cơ hội tiềm năng.",
			[FlowRole.TRACK]: "Theo dõi các vị thế giao dịch đang mở (Active).",
			[FlowRole.FORGE]: "Phân tích kỹ thuật, cơ bản để tìm kiếm lợi thế.",
			[FlowRole.BLUEPRINT]: "Xây dựng hệ thống quy tắc và kỷ luật giao dịch.",
			[FlowRole.EXHIBIT]: "Nhật ký giao dịch và bài học rút ra sau mỗi lệnh.",
			[FlowRole.VAULT]: "Lịch sử dữ liệu và các chu kỳ thị trường đã qua.",
		},
	},
	{
		id: "researcher",
		label: "Persona: Researcher",
		folders: {
			[FlowRole.CAPTURE]: "1. Input",
			[FlowRole.TRACK]: "2. Track",
			[FlowRole.FORGE]: "3. Study",
			[FlowRole.BLUEPRINT]: "4. Theory",
			[FlowRole.EXHIBIT]: "5. Paper",
			[FlowRole.VAULT]: "6. Archive",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Nạp dữ liệu thô, tài liệu tham khảo và trích dẫn.",
			[FlowRole.TRACK]: "Theo dõi lộ trình nghiên cứu và các thí nghiệm.",
			[FlowRole.FORGE]: "Học hỏi, phân tích và kết nối các giả thuyết.",
			[FlowRole.BLUEPRINT]: "Xây dựng khung lý thuyết và hệ thống phương pháp.",
			[FlowRole.EXHIBIT]: "Các bài báo, luận văn và báo cáo khoa học.",
			[FlowRole.VAULT]: "Lưu trữ dữ liệu gốc và các nghiên cứu kinh điển.",
		},
	},
	{
		id: "business_owner",
		label: "Persona: Business Owner",
		folders: {
			[FlowRole.CAPTURE]: "1. Intake",
			[FlowRole.TRACK]: "2. Ops",
			[FlowRole.FORGE]: "3. Core",
			[FlowRole.BLUEPRINT]: "4. Plan",
			[FlowRole.EXHIBIT]: "5. Stats",
			[FlowRole.VAULT]: "6. Archive",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Tiếp nhận thông tin khách hàng, đối tác và thị trường.",
			[FlowRole.TRACK]: "Vận hành doanh nghiệp và quản lý quy trình hàng ngày.",
			[FlowRole.FORGE]: "Phát triển các giá trị cốt lõi và lợi thế kinh doanh.",
			[FlowRole.BLUEPRINT]: "Lập kế hoạch chiến lược và sơ đồ tổ chức.",
			[FlowRole.EXHIBIT]: "Báo cáo tài chính, thống kê và kết quả kinh doanh.",
			[FlowRole.VAULT]: "Hồ sơ pháp lý và tài liệu lịch sử công ty.",
		},
	},
	{
		id: "freelancer",
		label: "Persona: Freelancer",
		folders: {
			[FlowRole.CAPTURE]: "1. Lead",
			[FlowRole.TRACK]: "2. Task",
			[FlowRole.FORGE]: "3. Work",
			[FlowRole.BLUEPRINT]: "4. Brand",
			[FlowRole.EXHIBIT]: "5. Show",
			[FlowRole.VAULT]: "6. Done",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Thu hút và ghi lại các liên hệ khách hàng tiềm năng.",
			[FlowRole.TRACK]: "Quản lý danh sách việc cần làm cho từng dự án.",
			[FlowRole.FORGE]: "Thực hiện công việc chuyên môn và sản xuất.",
			[FlowRole.BLUEPRINT]: "Xây dựng thương hiệu cá nhân và bộ kỹ năng.",
			[FlowRole.EXHIBIT]: "Trưng bày Portfolio và các dự án đã bàn giao.",
			[FlowRole.VAULT]: "Lưu trữ hợp đồng và lịch sử làm việc.",
		},
	},
	{
		id: "product_manager",
		label: "Persona: Product Manager",
		folders: {
			[FlowRole.CAPTURE]: "1. Pulse",
			[FlowRole.TRACK]: "2. Road",
			[FlowRole.FORGE]: "3. Craft",
			[FlowRole.BLUEPRINT]: "4. Logic",
			[FlowRole.EXHIBIT]: "5. Ship",
			[FlowRole.VAULT]: "6. Past",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Lắng nghe nhịp đập người dùng và phản hồi thị trường.",
			[FlowRole.TRACK]: "Theo dõi lộ trình (Roadmap) và ưu tiên công việc.",
			[FlowRole.FORGE]: "Xây dựng tài liệu yêu cầu sản phẩm (PRD) và UX.",
			[FlowRole.BLUEPRINT]: "Logic sản phẩm, chiến lược và mô hình kinh doanh.",
			[FlowRole.EXHIBIT]: "Thông tin phát hành (Release) và kết quả ra mắt.",
			[FlowRole.VAULT]: "Lưu trữ các phiên bản và nghiên cứu cũ.",
		},
	},
	{
		id: "lawyer",
		label: "Persona: Lawyer",
		folders: {
			[FlowRole.CAPTURE]: "1. Client",
			[FlowRole.TRACK]: "2. Case",
			[FlowRole.FORGE]: "3. Brief",
			[FlowRole.BLUEPRINT]: "4. Law",
			[FlowRole.EXHIBIT]: "5. Act",
			[FlowRole.VAULT]: "6. Past",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Tiếp nhận thông tin khách hàng và yêu cầu pháp lý.",
			[FlowRole.TRACK]: "Theo dõi tiến độ vụ việc và các kỳ hạn tố tụng.",
			[FlowRole.FORGE]: "Soạn thảo hồ sơ, lập luận và chiến lược tranh tụng.",
			[FlowRole.BLUEPRINT]: "Hệ thống văn bản luật, án lệ và quy định liên quan.",
			[FlowRole.EXHIBIT]: "Các bản án, hợp đồng và văn bản pháp lý đã ban hành.",
			[FlowRole.VAULT]: "Lưu trữ hồ sơ vụ án đã đóng.",
		},
	},
	{
		id: "accountant",
		label: "Persona: Accountant",
		folders: {
			[FlowRole.CAPTURE]: "1. Flow",
			[FlowRole.TRACK]: "2. Book",
			[FlowRole.FORGE]: "3. Check",
			[FlowRole.BLUEPRINT]: "4. Tax",
			[FlowRole.EXHIBIT]: "5. Report",
			[FlowRole.VAULT]: "6. Past",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Ghi nhận dòng tiền, chứng từ và hóa đơn đầu vào.",
			[FlowRole.TRACK]: "Quản lý sổ sách kế toán và các khoản công nợ.",
			[FlowRole.FORGE]: "Kiểm tra, đối soát và xử lý sai lệch số liệu.",
			[FlowRole.BLUEPRINT]: "Chính sách thuế, luật kế toán và quy trình tài chính.",
			[FlowRole.EXHIBIT]: "Báo cáo tài chính, quyết toán và kết quả kiểm toán.",
			[FlowRole.VAULT]: "Lưu trữ chứng từ gốc theo niên độ kế toán.",
		},
	},
	{
		id: "trainer",
		label: "Persona: Trainer",
		folders: {
			[FlowRole.CAPTURE]: "1. Idea",
			[FlowRole.TRACK]: "2. Class",
			[FlowRole.FORGE]: "3. Plan",
			[FlowRole.BLUEPRINT]: "4. Core",
			[FlowRole.EXHIBIT]: "5. Asset",
			[FlowRole.VAULT]: "6. Past",
		},
		descriptions: {
			[FlowRole.CAPTURE]: "Thu thập ý tưởng, nguyên liệu và câu chuyện giảng dạy.",
			[FlowRole.TRACK]: "Quản lý lịch dạy, danh sách lớp và học viên.",
			[FlowRole.FORGE]: "Thiết kế bài giảng, hoạt động và kịch bản đào tạo.",
			[FlowRole.BLUEPRINT]: "Xây dựng khung chương trình và triết lý đào tạo.",
			[FlowRole.EXHIBIT]: "Học liệu, slide và tài liệu phân phát cho học viên.",
			[FlowRole.VAULT]: "Kho lưu trữ các khóa học và phản hồi cũ.",
		},
	},
];

// ── Default settings ────────────────────────────────────────────────────

const defaultPreset = FLOW_PRESETS[0]!;

export const DEFAULT_SETTINGS: FlowPluginSettings = {
	presetId: "default",
	folderMap: { ...defaultPreset.folders },
	roleDescriptions: { ...defaultPreset.descriptions },
	useNumberPrefix: false,
	enableCustomSort: true,
	autoCreateFolders: false,
	showRibbonIcon: true,
	reminderCheckIntervalSec: 60, // 1 minute for accurate task reminders
	autoTOC: false,
	tocDataViewQueries: true,
	maxSubfolders: 9,
	captureStaleDays: 7,
	namingConvention: "any",
	startupAction: "none",
	startupFilePath: "",
	zenModeLevel: 1,
	healthScoring: {
		maxSubfolderDepth: 2,
		maxNotesPerFolder: 9,
		maxRootNotes: 9,
		staleThresholdDays: [3, 7, 14],
		metaCoverageThresholds: [50, 80],
		orphanRateThresholds: [5, 15, 30],
		oversizedFileThresholds: [5, 10],
	},
	reminders: {
		consolidateCapture: { enabled: false, frequency: "weekly", lastTriggered: 0, activeDays: [0, 1, 2, 3, 4, 5, 6], activeStartTime: "08:00", activeEndTime: "22:00" },
		dailyNote: { enabled: false, frequency: "daily", lastTriggered: 0, activeDays: [0, 1, 2, 3, 4, 5, 6], activeStartTime: "08:00", activeEndTime: "22:00" },
		weeklyReview: { enabled: false, frequency: "weekly", dayOfWeek: 0, lastTriggered: 0, activeDays: [0, 1, 2, 3, 4, 5, 6], activeStartTime: "08:00", activeEndTime: "22:00" },
		publishContent: { enabled: false, frequency: "weekly", lastTriggered: 0, activeDays: [0, 1, 2, 3, 4, 5, 6], activeStartTime: "08:00", activeEndTime: "22:00" },
		forgeCleanup: { enabled: false, frequency: "monthly", lastTriggered: 0, activeDays: [0, 1, 2, 3, 4, 5, 6], activeStartTime: "08:00", activeEndTime: "22:00" },
	},
	tagTaxonomy: [],
	vaultMissions: [],
	taxonomyDimensions: [
		{ id: "domain", label: "Domain", values: [] },
		{ id: "format", label: "Format", values: ["article", "video", "podcast", "note"] },
		{ id: "lifecycle", label: "Lifecycle", values: ["idea", "draft", "review", "published", "archived"] },
	],

	progressLifecycle: {
		stages: ["raw", "medium", "done", "archived"],
	},
	selectedFeelings: [],
	lastCachedStats: null,
	dashboardRefreshIntervalMin: 30,
	language: "vi",
	urgencyConfig: {
		fieldName: "urgency",
		levels: [
			{ value: 0, label: "Không khẩn cấp" },
			{ value: 1, label: "Khẩn cấp" },
		],
	},
	impactConfig: {
		fieldName: "impact",
		levels: [
			{ value: 1, label: "Rất thấp" },
			{ value: 2, label: "Thấp" },
			{ value: 3, label: "Trung bình" },
			{ value: 4, label: "Cao" },
			{ value: 5, label: "Rất cao" },
		],
	},
	publishFieldName: "publish",
	channelFieldName: "channel",
	taskFilters: {
		status: "todo",
		priority: "all"
	}
};

/** Find a preset by id */
export function getPresetById(id: string): FlowPreset | undefined {
	return FLOW_PRESETS.find((p) => p.id === id);
}

/**
 * Applies or removes the numerical prefix from a folder map.
 */
export function applyPrefixFormat(
	folderMap: FlowFolderMap,
	usePrefix: boolean
): FlowFolderMap {
	const result = { ...folderMap };
	for (const role of FLOW_ROLE_ORDER) {
		const roleIndex = FLOW_ROLE_ORDER.indexOf(role) + 1;
		const name = folderMap[role];
		const baseName = name.replace(/^\d+\.\s*/, "");
		result[role] = usePrefix ? `${roleIndex}. ${baseName}` : baseName;
	}
	return result;
}

/**
 * Detect the current preset based on existing vault folders.
 * Scans root folders and matches against known presets.
 * Supports folders with OR without number prefixes.
 */
export function detectCurrentPreset(rootFolderNames: string[]): { presetId: string; folderMap: Record<FlowRole, string>; usePrefix: boolean } | undefined {
	// Normalize: strip leading "N. " prefix for matching
	const stripPrefix = (name: string): string => name.replace(/^\d+\.\s*/, "");

	for (const preset of FLOW_PRESETS) {
		const presetNames = Object.values(preset.folders);
		const presetBareNames = presetNames.map(stripPrefix);

		// Check if all 6 preset folder names exist in the vault (with or without numbers)
		let matched = true;
		const detectedMap: Partial<Record<FlowRole, string>> = {};
		let usePrefixFound = false;

		for (const role of Object.keys(preset.folders) as FlowRole[]) {
			const presetName = preset.folders[role];
			const bareName = stripPrefix(presetName);

			// Try exact match first, then try bare name match
			const found = rootFolderNames.find((f) => f === presetName || stripPrefix(f) === bareName);
			if (found) {
				if (/^\d+\.\s*/.test(found)) {
					usePrefixFound = true;
				}
				detectedMap[role] = found; // Use the actual folder name on disk
			} else {
				matched = false;
				break;
			}
		}

		if (matched) {
			return { presetId: preset.id, folderMap: detectedMap as Record<FlowRole, string>, usePrefix: usePrefixFound };
		}
	}

	return undefined;
}
