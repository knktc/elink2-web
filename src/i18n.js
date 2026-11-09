const messages = {
  en: {
    tagline: "Keep your old elink2 flash cart going.",
    language: "Language",
    githubLink: "View elink2-web on GitHub",
    disconnected: "Not connected",
    connected: "USB ONLINE",
    connectTitle: "Let’s connect your elink2",
    connectBody:
      "Put the cart in your GBA. Connect the cart’s Mini-USB port to your computer, then turn on the GBA.",
    connect: "Connect cart",
    directHint: "Already seeing USB ONLINE on your GBA?",
    direct: "Read directly",
    stepHardware: "Connect your cart",
    stepPicker: "Choose a device",
    stepReady: "Read the cart",
    pickerTitle: "Choose your cart in Chrome",
    pickerBody:
      "In the USB device picker, select the device with ID [3998:5893], then click Connect. It may appear as “Unknown device”.",
    pickerNote:
      "An empty list? Check that your GBA is on and the USB cable is connected to the cart, then try again.",
    pickerIllustration: "USB picker example",
    pickerDevice: "Unknown device [3998:5893]",
    pickerSelect: "1. Select the device",
    pickerConfirm: "2. Click Connect",
    picker: "Waiting for USB permission…",
    initializing: "Getting the cart ready…",
    reading: "Reading the game list…",
    checking: "Checking the cart before writing…",
    writingRom: "Writing the game…",
    verifyingRom: "Reading back and checking the game…",
    writingMenu: "Updating the menu…",
    verifyingMenu: "Checking the new menu…",
    unsupported:
      "Open this page in desktop Chrome using HTTPS or localhost to connect your cart.",
    overview: "Your cart at a glance",
    addressWindow: "Cart capacity",
    used: "Games",
    available: "Appendable space",
    reserved: "Boot & menu",
    saves: "Save area",
    gap: "Unallocated gap",
    free: "Appendable",
    games: "Games",
    gameCount: "{count} games on your cart",
    slot: "No.",
    game: "Game",
    size: "Space",
    actions: "Actions",
    untitled: "Untitled",
    add: "Add a game",
    replace: "Replace ROM",
    deleteToEnd: "Delete to end",
    deleteSummary:
      "Delete {count} games, starting with “{title}” and including every game after it.",
    freedSpace: "Space reclaimed",
    availableAfterDelete: "Appendable after deletion",
    confirmDelete: "Delete {count} games",
    deleteFinishTitle: "Deletion complete",
    deleteVerifiedTitle: "Deletion complete and verified",
    deleteFinishBody:
      "Restart your GBA to check the menu. Reconnect here to read the updated list and add games.",
    refresh: "Read again",
    disconnect: "Disconnect",
    empty: "No games in this menu yet. Add a .gba file to get started.",
    readonly: "This layout is available for viewing only. Writing is disabled.",
    diagnostics: "Exports & diagnostics",
    menuBackup: "Download menu snapshot",
    logs: "Download log",
    local: "Your ROMs and cart data stay in this browser.",
    addTitle: "Add a game",
    replaceTitle: "Replace {title}",
    file: "Choose a .gba file",
    chooseFile: "Choose ROM",
    menuName: "Cart menu name",
    menuNameHint:
      "Up to 29 English characters or 14 Chinese characters, or a mix.",
    cartMenuPreview: "Menu text preview",
    titleEmpty: "Enter a menu name.",
    titleLength:
      "The name is too long. Use up to 29 English characters or 14 Chinese characters.",
    titleCharacter:
      "Use English, supported Chinese characters and punctuation; emoji are not supported.",
    titleWidth: "This name is too wide for the menu. Please shorten it.",
    titleHeight:
      "Some characters are too tall for this menu font. Please use different characters.",
    noFile: "Choose a GBA ROM to see the write preview.",
    preview: "Write preview",
    replacementDetails: "Replacement details",
    originalSpace: "Original space",
    cannotReplace: "Cannot replace this game",
    cannotWrite: "Cannot write this ROM",
    canReplace: "This ROM fits in the original game’s space.",
    replacementTooLarge:
      "The new ROM needs {required}, but the original space is {available}. It exceeds that space by {excess}.",
    requiredSpace: "Required space",
    original: "Replacing",
    newTitle: "New game",
    cancel: "Cancel",
    confirmWrite: "Write game",
    verifyAfterWrite: "Read back and verify after writing",
    writeFinishTitle: "Write complete",
    finishTitle: "Written and verified",
    finishBody:
      "Turn the GBA off, unplug USB, and turn it back on to check the game. Reconnect here to read the updated menu.",
    recoveryTitle: "The write needs checking",
    recoveryBody:
      "Cart data may have changed. Keep the log. Reconnect using “Read directly” if USB ONLINE is still shown, or restart your GBA before a normal connection.",
    errorTitle: "Couldn’t finish that step",
    canceled:
      "No device selected. You can connect again whenever you’re ready.",
    disconnectedError:
      "The cart was disconnected. Check the cable and connect again.",
    unknownError:
      "The USB operation failed. Check the connection and close other apps using the cart.",
    errorDetail: "Technical detail",
    close: "Close",
    busyNote: "Keep your GBA on and the cable connected.",
    retry: "Back to connection",
    source: "elink2-web · Keep the old cart going.",
    mapLabel: "Cart address map; choose a game to highlight its row",
    errors: {
      reconnectRequired:
        "The USB session could not be closed. Unplug the cart and reload this page before connecting again.",
      missingGame: "The selected game is no longer in the menu.",
      directorySize: "The menu snapshot has the wrong length.",
      directoryStatus: "The menu contains an unknown entry status.",
      configuration: "The cart is using an unexpected USB configuration.",
      descriptor: "The USB endpoints do not match the supported elink2.",
      uninitialized: "The cart menu has not been initialized.",
      layout:
        "The directory contains gaps in slot numbers, overlaps, invalid save slots or out-of-range entries.",
      romSize: "Choose a valid GBA ROM up to 256 Mbit.",
      alignment: "This game is not aligned to a 1 Mbit boundary.",
      replacementSpace:
        "This ROM does not fit in the selected game’s existing space.",
      slotsFull: "All 32 menu slots are in use.",
      space: "There is not enough continuous space at the end of the cart.",
      status: "The cart returned an unexpected status.",
      timeout:
        "The USB operation timed out. Reconnect the cart before retrying.",
      read: "The read returned incomplete data.",
      writeStatus: "The write returned an unexpected status.",
      transfer: "The USB transfer was incomplete.",
      initializer:
        "The initialization file is missing or its checksum does not match.",
      identity: "The cart header does not match the supported layout.",
      changed:
        "Read-back data does not match the expected snapshot. Reconnect and inspect the cart.",
      header: "This file does not contain a valid GBA header.",
      extension: "Choose a file with a .gba extension.",
    },
  },
  zh: {
    tagline: "让老 elink2 烧录卡继续用起来。",
    language: "语言",
    githubLink: "在 GitHub 上查看 elink2-web",
    disconnected: "未连接",
    connected: "USB ONLINE",
    connectTitle: "连接你的 elink2 卡带",
    connectBody:
      "将卡带插入 GBA。Mini-USB 线一端接卡带，另一端接电脑，然后打开 GBA。",
    connect: "连接卡带",
    directHint: "GBA 已显示 USB ONLINE？",
    direct: "直接读取",
    stepHardware: "连接硬件",
    stepPicker: "选择设备",
    stepReady: "读取卡带",
    pickerTitle: "在 Chrome 中选择卡带",
    pickerBody:
      "在弹出的 USB 设备选择器中，选中编号为 [3998:5893] 的设备，再点击「连接」。它可能显示为「未知设备」。",
    pickerNote: "列表为空？确认 GBA 已开机、USB 线已接到卡带，再重试。",
    pickerIllustration: "设备选择器示意",
    pickerDevice: "未知设备 [3998:5893]",
    pickerSelect: "1. 选中设备",
    pickerConfirm: "2. 点击「连接」",
    picker: "等待 USB 授权…",
    initializing: "正在准备卡带…",
    reading: "正在读取游戏列表…",
    checking: "正在检查卡带状态…",
    writingRom: "正在写入游戏…",
    verifyingRom: "正在读回并校验游戏…",
    writingMenu: "正在更新菜单…",
    verifyingMenu: "正在校验新菜单…",
    unsupported:
      "请在桌面版 Chrome 中打开此页面，再连接卡带。",
    overview: "卡带概览",
    addressWindow: "卡带容量",
    used: "游戏占用",
    available: "可追加空间",
    reserved: "引导与菜单",
    saves: "存档区",
    gap: "未分配间隙",
    free: "可追加",
    games: "游戏列表",
    gameCount: "卡带上共有 {count} 个游戏",
    slot: "序号",
    game: "游戏名称",
    size: "占用空间",
    actions: "操作",
    untitled: "无标题",
    add: "新增游戏",
    replace: "替换 ROM",
    deleteToEnd: "删除到末尾",
    deleteSummary:
      "将从「{title}」开始，删除它及之后的全部游戏，共 {count} 个。",
    freedSpace: "可腾出空间",
    availableAfterDelete: "删除后可追加空间",
    confirmDelete: "删除这 {count} 个游戏",
    deleteFinishTitle: "删除完成",
    deleteVerifiedTitle: "删除与校验完成",
    deleteFinishBody:
      "重启 GBA 检查游戏列表，重新连接后即可读取更新后的列表并新增游戏。",
    refresh: "重新读取",
    disconnect: "断开连接",
    empty: "菜单里还没有游戏，选择一个 .gba 文件开始。",
    readonly: "当前布局可供查看，写入功能已禁用。",
    diagnostics: "导出与诊断",
    menuBackup: "下载菜单快照",
    logs: "下载日志",
    local: "ROM 和卡带数据都在浏览器本地处理。",
    addTitle: "新增游戏",
    replaceTitle: "替换 {title}",
    file: "选择 .gba 文件",
    chooseFile: "选择 ROM",
    menuName: "卡带菜单名称",
    menuNameHint: "最多 29 个英文字符或 14 个汉字，可混合使用。",
    cartMenuPreview: "菜单文字预览",
    titleEmpty: "请输入菜单名称。",
    titleLength: "名称太长，请控制在 29 个英文字符或 14 个汉字以内。",
    titleCharacter: "请使用英文、支持的中文及标点，暂不支持表情符号等字符。",
    titleWidth: "名称超出了菜单显示宽度，请缩短一些。",
    titleHeight: "部分字符超出了菜单字体高度，请更换这些字符。",
    noFile: "选择一个 GBA ROM，查看写入预览。",
    preview: "写入预览",
    replacementDetails: "替换详情",
    originalSpace: "原始空间",
    cannotReplace: "无法替换此游戏",
    cannotWrite: "无法写入此 ROM",
    canReplace: "新 ROM 可以放入原游戏的空间。",
    replacementTooLarge:
      "新 ROM 需要 {required}，原始空间为 {available}，超出 {excess}。",
    requiredSpace: "所需空间",
    original: "原游戏",
    newTitle: "新游戏",
    cancel: "取消",
    confirmWrite: "写入游戏",
    verifyAfterWrite: "写入后读回校验",
    writeFinishTitle: "写入完成",
    finishTitle: "写入与校验完成",
    finishBody:
      "关闭 GBA，拔下 USB 线，再开机检查游戏。重新连接后，可以读取更新后的菜单。",
    recoveryTitle: "需要检查写入结果",
    recoveryBody:
      "卡带数据可能已经改变，请保留日志。若 GBA 仍显示 USB ONLINE，可用「直接读取」复查；否则请重启 GBA 后正常连接。",
    errorTitle: "这一步未能完成",
    canceled: "尚未选择设备，准备好后可以重新连接。",
    disconnectedError: "卡带连接已断开，请检查线缆后重新连接。",
    unknownError: "USB 操作失败，请检查连接，并关闭占用卡带的其他程序。",
    errorDetail: "技术详情",
    close: "关闭",
    busyNote: "请保持 GBA 开机和 USB 连接。",
    retry: "返回连接",
    source: "elink2-web · 让老烧录卡继续用起来。",
    mapLabel: "卡带地址分布图，选择游戏可高亮对应列表行",
    errors: {
      reconnectRequired: "USB 会话未能关闭，请拔下卡带并刷新页面，再重新连接。",
      missingGame: "游戏列表中已找不到选中的游戏。",
      directorySize: "菜单快照长度不正确。",
      directoryStatus: "菜单包含未知的记录状态。",
      configuration: "设备的 USB 配置不符合预期。",
      descriptor: "USB 端点与已支持的 elink2 不匹配。",
      uninitialized: "卡带目录尚未初始化。",
      layout: "目录存在槽位编号不连续、重叠、无效存档槽位或超出范围的记录。",
      romSize: "请选择不超过 256 Mbit 的有效 GBA ROM。",
      alignment: "该游戏的地址不满足 1 Mbit 对齐要求。",
      replacementSpace: "新 ROM 超过了所选游戏原有的空间。",
      slotsFull: "32 个菜单槽位已全部用完。",
      space: "卡带末尾的连续空间不足。",
      status: "卡带返回了异常状态。",
      timeout: "USB 操作超时，请重新连接卡带后再试。",
      read: "读取的数据不完整。",
      writeStatus: "卡带返回了异常写入状态。",
      transfer: "USB 传输未完整完成。",
      initializer: "初始化文件缺失或校验值不匹配。",
      identity: "卡带头部与已支持的布局不匹配。",
      changed: "读回数据与预期快照不一致，请重新连接并检查卡带。",
      header: "文件缺少有效的 GBA 头部。",
      extension: "请选择扩展名为 .gba 的文件。",
    },
  },
};
let locale = "en";
try {
  locale =
    localStorage.getItem("elink2-language") ||
    (navigator.language.startsWith("zh") ? "zh" : "en");
} catch {
  /* Storage may be disabled. */
}
if (!messages[locale]) locale = "en";
export function getLocale() {
  return locale;
}
export function setLocale(value) {
  locale = value === "zh" ? "zh" : "en";
  try {
    localStorage.setItem("elink2-language", locale);
  } catch {
    /* Language still works for this tab. */
  }
}
export function t(key, params = {}) {
  let value = messages[locale][key] || key;
  for (const [name, replacement] of Object.entries(params))
    value = value.replaceAll(`{${name}}`, replacement);
  return value;
}
export function errorText(error) {
  if (error.name === "NotFoundError") return t("canceled");
  if (error.name === "NetworkError") return t("disconnectedError");
  return messages[locale].errors[error.message] || t("unknownError");
}
