/**
 * i18n labels for FLOW Plugin Settings.
 * 
 * When language === "en": pure English, no Vietnamese annotations.
 * When language === "vi": Vietnamese text.
 * Property/tag values are ALWAYS in English regardless of language.
 */

import type { FlowPluginSettings } from "../types";

export interface SettingsLabels {
	// Tab names
	tabGeneral: string;
	tabFolders: string;
	tabTaxonomy: string;
	tabReminders: string;
	tabHealth: string;
	settingsTitle: string;

	// General tab
	showRibbonIcon: string;
	showRibbonIconDesc: string;
	dashboardRefresh: string;
	dashboardRefreshDesc: string;
	disabled: string;
	minutes: string;
	hour1: string;
	hours2: string;
	pluginLanguage: string;
	pluginLanguageDesc: string;
	tocSection: string;
	autoToc: string;
	autoTocDesc: string;
	includeDataview: string;
	includeDataviewDesc: string;
	generateTocFor: string;
	generateTocForDesc: string;
	generateTocBtn: string;
	ribbonReload: string;

	// Folders tab
	folderPreset: string;
	folderPresetDesc: string;
	numberPrefix: string;
	numberPrefixDesc: string;
	autoCreate: string;
	autoCreateDesc: string;
	customSort: string;
	customSortDesc: string;
	folderNames: string;
	switchToCustom: string;
	renamingNotice: string;

	// Taxonomy tab
	progressLifecycle: string;
	progressLifecycleDesc: string;
	addStage: string;
	addStageDesc: string;
	eisenhower: string;
	eisenhowerDesc: string;
	tagHierarchy: string;
	tagHierarchyDesc: string;
	addTag: string;
	addTagDesc: string;
	vaultMissions: string;
	vaultMissionsDesc: string;
	addMission: string;
	dimensions: string;
	dimensionsDesc: string;
	addDimension: string;
	feelingSpectrum: string;
	feelingSpectrumDesc: string;

	// Reminders tab
	checkInterval: string;
	checkIntervalDesc: string;
	reminderTypes: string;
	consolidateCapture: string;
	consolidateCaptureDesc: string;
	dailyNote: string;
	dailyNoteDesc: string;
	weeklyReview: string;
	weeklyReviewDesc: string;
	publishContent: string;
	publishContentDesc: string;
	forgeCleanup: string;
	forgeCleanupDesc: string;

	// Health tab
	staleCaptureDays: string;
	staleCaptureDaysDesc: string;
	maxSubfolders: string;
	maxSubfoldersDesc: string;
	maxSubfolderDepth: string;
	maxSubfolderDepthDesc: string;
	namingConventionLabel: string;
	namingConventionDesc: string;
	scoringSection: string;
	scoringSectionDesc: string;
	maxNotesPerFolder: string;
	maxNotesPerFolderDesc: string;
	maxRootNotes: string;
	maxRootNotesDesc: string;
	staleThresholds: string;
	staleThresholdsDesc: string;
	metaCoverage: string;
	metaCoverageDesc: string;
	orphanThresholds: string;
	orphanThresholdsDesc: string;
	oversizedThresholds: string;
	oversizedThresholdsDesc: string;

	// Taxonomy extra
	publishField: string;
	publishFieldDesc: string;
	channelField: string;
	channelFieldDesc: string;

	// General extra
	vaultTemplate: string;
	vaultTemplateDesc: string;
	downloadBtn: string;

	// Form inputs & Placeholders
	newStageName: string;
	addBtn: string;
	valuePlaceholder: string;
	labelPlaceholder: string;
	noTagsRegistered: string;
	dimensionLabel: string;
	addValuePlaceholder: string;
	missionNamePlaceholder: string;
	descriptionPlaceholder: string;
	tagsPlaceholder: string;
	propertyKeyDesc: string;
}

const LABELS_VI: SettingsLabels = {
	tabGeneral: "Tổng quan",
	tabFolders: "Thư mục",
	tabTaxonomy: "Tổ chức thông tin",
	tabReminders: "Nhắc nhở",
	tabHealth: "Sức khoẻ Vault",
	settingsTitle: "Cài đặt Plugin FLOW",

	showRibbonIcon: "Hiển thị icon ribbon",
	showRibbonIconDesc: "Hiển thị icon Dashboard FLOW trên thanh ribbon bên trái. Cần tải lại plugin để áp dụng.",
	dashboardRefresh: "Chu kỳ tự động làm mới",
	dashboardRefreshDesc: "Tần suất plugin làm mới thống kê Dashboard ở chế độ nền (0 = tắt, chỉ làm mới thủ công).",
	disabled: "Tắt",
	minutes: "phút",
	hour1: "1 giờ",
	hours2: "2 giờ",
	pluginLanguage: "Ngôn ngữ plugin",
	pluginLanguageDesc: "Ngôn ngữ hiển thị mặc định cho Dashboard và tab Progression.",
	tocSection: "Mục lục",
	autoToc: "Tự động tạo file mục lục",
	autoTocDesc: "Bật theo dõi tự động: tạo lại file \"0. TOC.md\" khi ghi chú được thêm, xoá hoặc đổi tên.",
	includeDataview: "Sử dụng DataView",
	includeDataviewDesc: "Dùng DataView code blocks cho danh sách động (yêu cầu plugin DataView). Nếu tắt, danh sách tĩnh sẽ được tạo.",
	generateTocFor: "Tạo TOC cho thư mục",
	generateTocForDesc: "Chọn thư mục FLOW nào sẽ nhận file TOC, sau đó nhấn Tạo.",
	generateTocBtn: "Tạo TOC",
	ribbonReload: "Tải lại plugin để áp dụng.",

	folderPreset: "Mẫu thư mục",
	folderPresetDesc: "Chọn mẫu để định nghĩa tên thư mục FLOW, hoặc chọn Tuỳ chỉnh để đặt tên riêng.",
	numberPrefix: "Dùng tiền tố số",
	numberPrefixDesc: "Thêm tiền tố \"1. \", \"2. \" vào tên thư mục (ví dụ: \"1. Capture\" thay vì \"Capture\").",
	autoCreate: "Tự tạo thư mục",
	autoCreateDesc: "Tự động tạo các thư mục FLOW bị thiếu khi plugin khởi động.",
	customSort: "Sắp xếp thư mục tuỳ chỉnh",
	customSortDesc: "Ghim thư mục FLOW lên đầu File Explorer theo thứ tự chuẩn (Capture → Track → Forge → Blueprint → Exhibit → Vault).",
	folderNames: "Tên thư mục",
	switchToCustom: "Chuyển sang mẫu \"Tuỳ chỉnh\" ở trên để sửa tên thư mục thủ công.",
	renamingNotice: "FLOW: Đang đổi tên thư mục... Hãy đảm bảo đã bật 'Tự động cập nhật liên kết nội bộ' trong Files & Links.",

	progressLifecycle: "Vòng đời tiến trình",
	progressLifecycleDesc: "Định nghĩa các giai đoạn cho thuộc tính 'progress' của ghi chú. Thay đổi sẽ đề xuất đổi tên tất cả giá trị hiện có.",
	addStage: "Thêm giai đoạn",
	addStageDesc: "Thêm giai đoạn tiến trình mới vào vòng đời.",
	eisenhower: "Ma trận Eisenhower (Urgency & Impact)",
	eisenhowerDesc: "Cấu hình các trường urgency và impact dùng cho phân loại ưu tiên. Đổi tên trường sẽ cập nhật tất cả ghi chú.",
	tagHierarchy: "Phân cấp Tag",
	tagHierarchyDesc: "Định nghĩa trước cấu trúc tag để chuẩn hoá ghi chú. Các tag đã đăng ký sẽ được gợi ý khi gõ '#'.",
	addTag: "Thêm tag",
	addTagDesc: "Dùng \"/\" cho phân cấp, ví dụ: \"project/python/vnstock\"",
	vaultMissions: "Kế Hoạch Dùng Vault",
	vaultMissionsDesc: "Định nghĩa các mục tiêu, dự án lớn. File trong thư mục Blueprint được tự động nhận diện.",
	addMission: "+ Thêm nhiệm vụ",
	dimensions: "Chiều phân loại thông tin",
	dimensionsDesc: "Định nghĩa các chiều phân loại thông tin trong vault (ví dụ: lĩnh vực, định dạng, vòng đời).",
	addDimension: "Thêm chiều",
	feelingSpectrum: "Phổ cảm xúc",
	feelingSpectrumDesc: "Chọn cảm xúc từ bánh xe cảm xúc để dùng làm thuộc tính trong ghi chú hàng ngày.",

	checkInterval: "Chu kỳ kiểm tra (giây)",
	checkIntervalDesc: "Tần suất plugin kiểm tra điều kiện nhắc nhở. Mặc định: 3600 (1 giờ).",
	reminderTypes: "Loại nhắc nhở",
	consolidateCapture: "Tổng hợp ghi chú Capture",
	consolidateCaptureDesc: "Nhắc xử lý các ghi chú thô trong Capture thành kiến thức sâu hơn.",
	dailyNote: "Viết nhật ký",
	dailyNoteDesc: "Nhắc viết bài suy ngẫm hàng ngày trong Track.",
	weeklyReview: "Đánh giá tuần",
	weeklyReviewDesc: "Nhắc đánh giá và dọn dẹp vault cuối mỗi tuần.",
	publishContent: "Xuất bản nội dung",
	publishContentDesc: "Nhắc chuyển ít nhất một bài sang Exhibit mỗi tuần.",
	forgeCleanup: "Dọn dẹp Forge",
	forgeCleanupDesc: "Nhắc giữ Forge gọn gàng (tối đa 7±2 thư mục con hoạt động).",

	staleCaptureDays: "Ngày ghi chú cũ (Capture)",
	staleCaptureDaysDesc: "Số ngày trước khi ghi chú trong Capture bị coi là cũ và cần xử lý.",
	maxSubfolders: "Số thư mục con tối đa",
	maxSubfoldersDesc: "Con số tham chiếu tối đa số thư mục con trong mỗi thư mục FLOW để dễ quản lý. Dùng cho báo cáo sức khoẻ vault.",
	maxSubfolderDepth: "Số cấp thư mục con tối đa",
	maxSubfolderDepthDesc: "Số lớp thư mục lồng nhau tối đa khuyến nghị. Vượt quá sẽ bị trừ điểm sức khoẻ.",
	namingConventionLabel: "Quy ước đặt tên file",
	namingConventionDesc: "Chọn kiểu đặt tên file ưu tiên trong vault (ví dụ: dấu gạch ngang, gạch dưới, khoảng trắng...).",
	scoringSection: "Cấu hình chấm điểm",
	scoringSectionDesc: "Tinh chỉnh các ngưỡng dùng để đánh giá sức khoẻ vault trên Dashboard.",
	maxNotesPerFolder: "Số note tối đa mỗi thư mục",
	maxNotesPerFolderDesc: "Số ghi chú tối đa trong 1 thư mục trước khi bị cảnh báo quá nhiều.",
	maxRootNotes: "Số note tối đa ở thư mục gốc",
	maxRootNotesDesc: "Số ghi chú nằm trực tiếp ở gốc mỗi thư mục FLOW trước khi bị trừ điểm.",
	staleThresholds: "Ngưỡng tuổi ghi chú Capture (ngày)",
	staleThresholdsDesc: "3 ngưỡng [tốt, cảnh báo, xấu] tính theo ngày. Ví dụ: [3, 7, 14] nghĩa là quá 3 ngày là bắt đầu mất điểm.",
	metaCoverage: "Ngưỡng bao phủ Metadata (%)",
	metaCoverageDesc: "2 ngưỡng [khá, tốt] tính theo %. Ví dụ: [50, 80] nghĩa là 50% trở lên cho mức khá, 80% trở lên cho mức tốt.",
	orphanThresholds: "Ngưỡng tệp mồ côi (%)",
	orphanThresholdsDesc: "3 ngưỡng [tốt, cảnh báo, xấu] tính theo % dung lượng tệp mồ côi so với tổng vault.",
	oversizedThresholds: "Ngưỡng file quá lớn (số file)",
	oversizedThresholdsDesc: "2 ngưỡng [cảnh báo, xấu]. Ví dụ: [5, 10] nghĩa là quá 5 file lớn sẽ bị cảnh báo, quá 10 sẽ bị trừ nặng.",

	publishField: "Tên thuộc tính ngày đăng",
	publishFieldDesc: "Tên thuộc tính frontmatter chứa ngày dự kiến đăng bài công khai (mặc định: publish).",
	channelField: "Tên thuộc tính kênh đăng tải",
	channelFieldDesc: "Tên thuộc tính frontmatter chứa kênh đăng tải nội dung, ví dụ: blog, youtube, newsletter (mặc định: channel).",

	vaultTemplate: "Mẫu Vault FLOW",
	vaultTemplateDesc: "Tải mẫu Vault FLOW từ Learn Anything để khai phá trọn vẹn sức mạnh của hệ thống.",
	downloadBtn: "Tải về",

	newStageName: "Tên giai đoạn mới...",
	addBtn: "+ Thêm",
	valuePlaceholder: "Giá trị",
	labelPlaceholder: "Nhãn",
	noTagsRegistered: "Chưa có tag nào được đăng ký. Hãy thêm tag đầu tiên của bạn ở dưới.",
	dimensionLabel: "Nhãn chiều phân loại",
	addValuePlaceholder: "Thêm giá trị...",
	missionNamePlaceholder: "Tên nhiệm vụ",
	descriptionPlaceholder: "Mô tả",
	tagsPlaceholder: "Tags (cách nhau bởi dấu phẩy)",
	propertyKeyDesc: "Thuộc tính YAML frontmatter. Việc đổi tên trường này sẽ tự động cập nhật tất cả ghi chú trong Vault.",
};

const LABELS_EN: SettingsLabels = {
	tabGeneral: "General",
	tabFolders: "Folders",
	tabTaxonomy: "Taxonomy",
	tabReminders: "Reminders",
	tabHealth: "Vault Health",
	settingsTitle: "FLOW Plugin Settings",

	showRibbonIcon: "Show ribbon icon",
	showRibbonIconDesc: "Show the FLOW Dashboard icon in the left ribbon. Requires plugin reload to take effect.",
	dashboardRefresh: "Dashboard auto-refresh interval",
	dashboardRefreshDesc: "How often the plugin refreshes Dashboard statistics in the background (0 = disabled, manual refresh only).",
	disabled: "Disabled",
	minutes: "minutes",
	hour1: "1 hour",
	hours2: "2 hours",
	pluginLanguage: "Plugin language",
	pluginLanguageDesc: "Default display language for the FLOW Dashboard and Progression tab.",
	tocSection: "Table of Contents",
	autoToc: "Auto-generate TOC",
	autoTocDesc: "Enable auto-watcher: regenerates \"0. TOC.md\" files when notes are added, deleted, or renamed.",
	includeDataview: "Include DataView queries",
	includeDataviewDesc: "Use DataView code blocks for dynamic listing (requires DataView plugin). If off, a static file list is generated.",
	generateTocFor: "Generate TOC for folders",
	generateTocForDesc: "Select which FLOW folders should receive a TOC file, then click Generate.",
	generateTocBtn: "Generate TOC",
	ribbonReload: "Reload the plugin to apply.",

	folderPreset: "Folder style preset",
	folderPresetDesc: "Choose a preset to define your FLOW folder names, or select Custom to set your own.",
	numberPrefix: "Use number prefixes",
	numberPrefixDesc: "Prefix folder names with \"1. \", \"2. \", etc. (e.g. \"1. Capture\" vs \"Capture\").",
	autoCreate: "Auto-create folders",
	autoCreateDesc: "Automatically create missing FLOW folders when the plugin loads.",
	customSort: "Custom folder sorting",
	customSortDesc: "Pin FLOW folders at the top of File Explorer in their canonical order (Capture → Track → Forge → Blueprint → Exhibit → Vault).",
	folderNames: "Folder names",
	switchToCustom: "Switch to \"Custom\" preset above to edit folder names manually.",
	renamingNotice: "FLOW: Renaming folders... Please ensure 'Automatically update internal links' is enabled in Files & Links.",

	progressLifecycle: "Progress Lifecycle",
	progressLifecycleDesc: "Define the lifecycle stages for your notes' 'progress' frontmatter property. Changing these will offer to rename all existing values across the vault.",
	addStage: "Add stage",
	addStageDesc: "Add a new progress stage to the lifecycle.",
	eisenhower: "Eisenhower Matrix (Urgency & Impact)",
	eisenhowerDesc: "Configure the urgency and impact frontmatter fields used for prioritization. Renaming a field will update all existing notes in the vault.",
	tagHierarchy: "Tag Hierarchy",
	tagHierarchyDesc: "Pre-define your tag structure to standardize notes across the vault. Tags registered here will be suggested when you type '#' in the editor.",
	addTag: "Add tag",
	addTagDesc: "Use \"/\" for hierarchy, e.g. \"project/python/vnstock\"",
	vaultMissions: "Vault Missions (Blueprints)",
	vaultMissionsDesc: "Define your major goals, projects, or missions. These represent the Blueprint-level objectives of your vault. Files found in the Blueprint folder are auto-detected.",
	addMission: "+ Add Mission",
	dimensions: "Information Dimensions",
	dimensionsDesc: "Define the dimensions you use to classify information in your vault (e.g. domain, format, lifecycle).",
	addDimension: "Add dimension",
	feelingSpectrum: "Feeling Spectrum",
	feelingSpectrumDesc: "Select feelings from the emotion wheel to use as properties in your daily notes. Selected values will be available as auto-suggestions.",

	checkInterval: "Check interval (seconds)",
	checkIntervalDesc: "How often the plugin checks reminder conditions. Default: 3600 (1 hour).",
	reminderTypes: "Reminder types",
	consolidateCapture: "Consolidate Capture notes",
	consolidateCaptureDesc: "Remind to process raw notes in Capture into deeper knowledge.",
	dailyNote: "Write Daily Note",
	dailyNoteDesc: "Remind to write a daily reflection in Track.",
	weeklyReview: "Weekly Review",
	weeklyReviewDesc: "Remind to review and tidy up your vault at the end of each week.",
	publishContent: "Publish content",
	publishContentDesc: "Remind to move at least one piece to Exhibit per week.",
	forgeCleanup: "Forge cleanup",
	forgeCleanupDesc: "Remind to keep Forge tidy (max 7±2 active subfolders).",

	staleCaptureDays: "Stale Capture days",
	staleCaptureDaysDesc: "Number of days before a note in Capture is considered stale and flagged for processing.",
	maxSubfolders: "Max subfolders per folder",
	maxSubfoldersDesc: "Recommended maximum number of subfolders per FLOW folder for easy management. Used in vault health scoring.",
	maxSubfolderDepth: "Max subfolder depth",
	maxSubfolderDepthDesc: "Maximum recommended nesting depth for subfolders. Exceeding this will decrease health score.",
	namingConventionLabel: "File naming convention",
	namingConventionDesc: "Choose a preferred file naming style for your vault (e.g. dashes, underscores, spaces...).",
	scoringSection: "Scoring Configuration",
	scoringSectionDesc: "Fine-tune the thresholds used to evaluate vault health on the Dashboard.",
	maxNotesPerFolder: "Max notes per folder",
	maxNotesPerFolderDesc: "Maximum number of notes per folder before being flagged as overcrowded.",
	maxRootNotes: "Max root-level notes",
	maxRootNotesDesc: "Maximum notes at root of each FLOW folder before a health penalty.",
	staleThresholds: "Capture note age thresholds (days)",
	staleThresholdsDesc: "3 thresholds [good, warning, bad] in days. E.g. [3, 7, 14] means >3 days starts losing points.",
	metaCoverage: "Metadata coverage thresholds (%)",
	metaCoverageDesc: "2 thresholds [good, excellent] in %. E.g. [50, 80] means 50%+ is good, 80%+ is excellent.",
	orphanThresholds: "Orphaned file thresholds (%)",
	orphanThresholdsDesc: "3 thresholds [good, warning, bad] as % of orphaned attachment size vs total vault size.",
	oversizedThresholds: "Oversized file thresholds (count)",
	oversizedThresholdsDesc: "2 thresholds [warning, bad]. E.g. [5, 10] means >5 large files triggers warning, >10 triggers penalty.",

	publishField: "Publish date property",
	publishFieldDesc: "Frontmatter property name for the planned publish date (default: publish).",
	channelField: "Channel property",
	channelFieldDesc: "Frontmatter property name for the content distribution channel, e.g. blog, youtube, newsletter (default: channel).",

	vaultTemplate: "FLOW Vault Template",
	vaultTemplateDesc: "Download the official FLOW Vault template from Learn Anything to unlock the full power of the system.",
	downloadBtn: "Download",

	newStageName: "New stage name...",
	addBtn: "+ Add",
	valuePlaceholder: "Value",
	labelPlaceholder: "Label",
	noTagsRegistered: "No tags registered yet. Add your first tag below.",
	dimensionLabel: "Dimension label",
	addValuePlaceholder: "Add value...",
	missionNamePlaceholder: "Mission name",
	descriptionPlaceholder: "Description",
	tagsPlaceholder: "Tags (comma-sep)",
	propertyKeyDesc: "The YAML frontmatter property key. Renaming updates all vault notes.",
};

export function getSettingsLabels(settings: FlowPluginSettings): SettingsLabels {
	return settings.language === "en" ? LABELS_EN : LABELS_VI;
}
