(function () {
  "use strict";

  var storageKey = "reportmode-skill-builder-v1";
  var defaults = {
    skillTitle: "Jeremy Magazine Report",
    skillSlug: "jeremy-magazine-report",
    skillDescription: "검증 가능한 출처를 바탕으로 사양, 장단점, 판단 기준을 매거진형 HTML 보고서로 만듭니다.",
    reportType: "product",
    layoutType: "magazine",
    align: "left",
    accentColor: "#ff5c35",
    highlightStyle: "marker",
    intensity: "standard",
    aggressiveHighlight: true,
    titleFont: "Noto Serif KR",
    bodyFont: "Noto Sans KR",
    titleSize: 72,
    bodySize: 17,
    lineHeight: 172,
    contentWidth: 960,
    cardRadius: 18,
    surfaceTheme: "warm",
    sections: { summary: true, specs: true, tradeoffs: true, decisions: true, sources: true }
  };

  var typeLabels = {
    product: "Product Intelligence",
    executive: "Executive Brief",
    market: "Market Intelligence",
    technical: "Technical Review",
    research: "Research Digest"
  };

  var typeRules = {
    product: "제품의 공식 사양과 미확정 정보를 분리하고, 사용자가 얻게 되는 가치와 감수할 단점을 같은 비중으로 비교한다.",
    executive: "경영진이 5분 안에 결정할 수 있도록 결론, 핵심 수치, 위험, 권고 행동을 먼저 제시한다.",
    market: "시장 규모, 경쟁 구도, 고객 변화, 기회와 위협을 비교하고 모든 수치의 기준 시점과 출처를 표시한다.",
    technical: "구조, 작동 원리, 구현 선택지, 한계와 운영 영향을 기술하되 비전문가도 이해할 수 있는 설명을 함께 쓴다.",
    research: "여러 원문의 공통점과 충돌점을 묶고 사실, 분석, 전망을 명확히 구분한 리서치 다이제스트를 만든다."
  };

  var layoutLabels = {
    magazine: "따뜻한 매거진",
    whitepaper: "기업 백서",
    editorial: "강한 에디토리얼",
    minimal: "절제된 문서",
    dark: "프리미엄 다크"
  };

  var themeMap = {
    warm: { bg: "#f4efe4", paper: "#fffdf7", ink: "#1c1b17", muted: "#716d63" },
    clean: { bg: "#f2f5f7", paper: "#ffffff", ink: "#15181b", muted: "#667078" },
    stone: { bg: "#e8e7e2", paper: "#f8f7f3", ink: "#25241f", muted: "#74716a" },
    night: { bg: "#16171b", paper: "#202126", ink: "#f2f0e9", muted: "#aaa9a3" }
  };

  var state = loadState();
  var report = document.getElementById("reportPreview");
  var modal = document.getElementById("resultModal");
  var output = document.getElementById("skillOutput");
  var toast = document.getElementById("toast");
  var toastTimer;

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!saved) return clone(defaults);
      return Object.assign(clone(defaults), saved, {
        sections: Object.assign({}, defaults.sections, saved.sections || {})
      });
    } catch (error) {
      return clone(defaults);
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function slugify(value) {
    var slug = String(value || "").toLowerCase().trim()
      .replace(/[^a-z0-9가-힣\s-]/g, "")
      .replace(/[가-힣]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return slug || "custom-report-skill";
  }

  function yamlText(value) {
    return JSON.stringify(String(value || "").replace(/\r?\n/g, " "));
  }

  function selectedSections() {
    var labels = {
      summary: "한 문장 판단, 경영진 요약, 핵심 수치",
      specs: "사양 또는 핵심 데이터 표",
      tradeoffs: "장점과 단점 병렬 비교",
      decisions: "사용자 판단 기준과 체크리스트",
      sources: "출처 목록과 확인 범위"
    };
    return Object.keys(state.sections).filter(function (key) {
      return state.sections[key];
    }).map(function (key) {
      return labels[key];
    });
  }

  function highlightRule() {
    var styles = {
      marker: "핵심 문장 뒤에 불규칙한 마커 띠를 깐다",
      underline: "핵심어 아래에 굵은 컬러 밑줄을 긋는다",
      band: "핵심어 배경 전체를 컬러 밴드로 채우고 대비되는 글자색을 쓴다",
      leftbar: "핵심 문장 왼쪽에 굵은 세로 강조선을 둔다"
    };
    var intensities = {
      subtle: "은은한 강도, 투명도 약 28%",
      standard: "표준 강도, 투명도 약 72%",
      active: "강한 강도, 글자 높이의 약 80%"
    };
    return styles[state.highlightStyle] + ". " + intensities[state.intensity] + ". " +
      (state.aggressiveHighlight
        ? "적극 사용: 핵심 수치, 최종 판단, 위험 경고, 섹션별 핵심어에 반복 적용하되 한 문단에 두 번을 넘기지 않는다."
        : "절제 사용: 표지나 최종 판단 등 문서 전체에서 3~5곳에만 적용한다.");
  }

  function buildSkillMarkdown() {
    var tick = String.fromCharCode(96);
    var dateExample = "YYMMDD-english-slug.html";
    var sections = selectedSections();
    if (!sections.length) sections = ["제목, 본문, 출처"];
    var lines = [
      "---",
      "name: " + slugify(state.skillSlug),
      "description: " + yamlText(state.skillDescription),
      "version: 1.0.0",
      "metadata:",
      "  hermes:",
      "    category: reporting",
      "    tags:",
      "      - report",
      "      - html",
      "      - " + state.reportType,
      "---",
      "",
      "# " + (state.skillTitle || "Custom Report Skill"),
      "",
      "## 언제 이 스킬을 사용하는가",
      "",
      "사용자가 조사 보고서, 비교 분석, 사양 정리, 장단점 분석 또는 의사결정 문서를 요청할 때 사용한다.",
      "사용자가 주제, 독자, 목적, 참고 URL 또는 원문을 주면 아래 규칙으로 하나의 완결된 HTML 보고서를 만든다.",
      "",
      "## 결과물",
      "",
      "- 최종 산출물은 브라우저에서 바로 열 수 있는 독립형 HTML 파일 1개다.",
      "- 파일명은 한국시간 생성일을 기준으로 " + tick + dateExample + tick + " 형식을 쓴다.",
      "- 화면에는 " + tick + "YYMMDD · 보고서 제목" + tick + ", 본문에는 " + tick + "YYYY.MM.DD KST" + tick + "를 표시한다.",
      "- HTML 안에 CSS를 포함한다. 외부 빌드 도구나 별도 서버를 요구하지 않는다.",
      "- PC, 390px 모바일, 인쇄 화면에서 읽을 수 있어야 한다.",
      "",
      "## 이 스킬의 보고서 타입",
      "",
      "- 타입: " + typeLabels[state.reportType],
      "- 목적 규칙: " + typeRules[state.reportType],
      "",
      "## 디자인 계약",
      "",
      "아래 값은 취향 제안이 아니라 반드시 지켜야 하는 고정 레이아웃 토큰이다.",
      "",
      "- 레이아웃: " + layoutLabels[state.layoutType] + " (" + state.layoutType + ")",
      "- 표지 정렬: " + state.align,
      "- 강조색: " + state.accentColor,
      "- 제목 폰트: " + state.titleFont + ", 대체 글꼴 serif",
      "- 본문 폰트: " + state.bodyFont + ", 대체 글꼴 sans-serif",
      "- 표지 제목 크기: 데스크톱 " + state.titleSize + "px, 모바일 clamp로 축소",
      "- 본문 크기: " + state.bodySize + "px",
      "- 본문 줄 간격: " + (state.lineHeight / 100).toFixed(2),
      "- 콘텐츠 최대 폭: " + state.contentWidth + "px",
      "- 카드 모서리: " + state.cardRadius + "px",
      "- 배경색: " + themeMap[state.surfaceTheme].bg,
      "- 문서색: " + themeMap[state.surfaceTheme].paper,
      "- 본문색: " + themeMap[state.surfaceTheme].ink,
      "- 보조색: " + themeMap[state.surfaceTheme].muted,
      "- 제목은 넓은 여백과 강한 크기 대비를 사용하고, 본문은 긴 글을 편하게 읽는 행간을 유지한다.",
      "- 표, 카드, 인용문은 장식보다 정보의 위계를 분명하게 만드는 데 사용한다.",
      "",
      "## 하이라이트 계약",
      "",
      "- " + highlightRule(),
      "- 강조색은 " + state.accentColor + " 하나를 중심으로 사용한다.",
      "- 출처가 없는 주장이나 단순 수식어를 강조하지 않는다.",
      "- 강조 때문에 문장 가독성이나 인쇄 가독성이 떨어지면 투명도만 낮춘다.",
      "",
      "## 필수 섹션",
      ""
    ];
    sections.forEach(function (section) {
      lines.push("- " + section);
    });
    lines = lines.concat([
      "",
      "필수 섹션 외에도 주제에 필요하면 타임라인, 비교표, 인용문, 위험 요소를 추가할 수 있다.",
      "",
      "## 근거와 작성 규칙",
      "",
      "1. 사용자가 제공한 URL은 모두 확인한다. 하나라도 열리지 않으면 어떤 출처가 실패했는지 알리고 추측으로 채우지 않는다.",
      "2. 중요한 문장에는 사실, 분석, 전망, 루머 중 하나의 성격이 드러나게 쓴다.",
      "3. 공식 발표와 언론 보도, 공급망 정보, 개인 의견을 섞지 않는다.",
      "4. 상충하는 수치는 임의로 하나로 합치지 말고 범위와 충돌 사실을 함께 적는다.",
      "5. 기사 전문을 복제하지 않는다. 제목, 발행처, URL, 발행일 또는 확인일만 출처에 남긴다.",
      "6. 원문에 없는 내용을 사실처럼 만들지 않는다. 불확실하면 불확실하다고 쓴다.",
      "7. 한국어 보고서는 짧고 명확한 문장으로 쓰고 불필요한 전문용어는 풀어서 설명한다.",
      "",
      "## 제작 순서",
      "",
      "1. 요청에서 주제, 목적, 독자, 언어, 출처를 추출한다.",
      "2. 출처를 확인하고 핵심 사실, 충돌 지점, 미확정 정보를 분리한다.",
      "3. 먼저 한 문장 결론과 전체 목차를 만든다.",
      "4. 필수 섹션에 근거를 배치하고 각 주장에 출처 링크를 연결한다.",
      "5. 디자인 계약의 색상, 글꼴, 크기, 여백, 카드, 하이라이트를 CSS 변수로 구현한다.",
      "6. 모바일과 인쇄용 미디어 쿼리를 포함한다.",
      "7. 파일을 저장한 뒤 제목, 날짜, 출처 링크, 모바일 폭에서의 넘침을 직접 확인한다.",
      "",
      "## 레이아웃 구현 지침",
      "",
      "- CSS 변수 이름은 " + tick + "--accent" + tick + ", " + tick + "--paper" + tick + ", " + tick + "--ink" + tick + ", " + tick + "--muted" + tick + ", " + tick + "--title-font" + tick + ", " + tick + "--body-font" + tick + "를 쓴다.",
      "- 표지는 유형명, 생성일, 큰 제목, 한 줄 설명, 출처 수를 포함한다.",
      "- 핵심 수치는 2~4개의 카드로 묶고 수치 아래에 의미를 한 줄로 설명한다.",
      "- 장점과 단점은 같은 폭과 비슷한 정보량으로 나란히 배치하고 모바일에서는 세로로 쌓는다.",
      "- 출처 링크는 실제 URL을 사용하며 새 탭에서 안전하게 열리게 한다.",
      "- 공개 HTML 안에는 API 키 입력, 생성 버튼, 관리자 기능을 넣지 않는다.",
      "",
      "## 예시 방향",
      "",
      "Apple 폴더블 iPhone을 다룬다면 공식 발표 전이라는 상태를 표지에 표시하고, 예상 화면 크기와 가격 같은 수치는 출처별 차이를 보존한다.",
      "장점은 대화면 멀티태스킹과 Apple 생태계 연속성, 단점은 1세대 내구성, 무게, 가격, 수리비를 다룬다.",
      "최종 판단은 실측 무게, 실제 배터리 시간, 화면 주름, 앱 최적화, 보증 정책을 확인한 뒤 구매하도록 정리한다.",
      "",
      "## 완료 응답",
      "",
      "보고서를 만든 뒤 사용자에게 다음 항목만 명확히 전달한다.",
      "",
      "- 생성일",
      "- 보고서 제목",
      "- 사용한 출처 수",
      "- 저장된 HTML 절대 경로",
      "- 확인하지 못한 내용 또는 남은 불확실성",
      ""
    ]);
    return lines.join("\n");
  }

  function setField(id, value) {
    var element = document.getElementById(id);
    if (element) element.value = value;
  }

  function hydrateControls() {
    ["skillTitle", "skillSlug", "skillDescription", "reportType", "layoutType", "accentColor", "highlightStyle", "titleFont", "bodyFont", "titleSize", "bodySize", "lineHeight", "contentWidth", "cardRadius", "surfaceTheme"].forEach(function (key) {
      setField(key, state[key]);
    });
    setField("accentHex", state.accentColor);
    document.getElementById("aggressiveHighlight").checked = state.aggressiveHighlight;
    document.querySelectorAll("[data-section]").forEach(function (input) {
      input.checked = state.sections[input.dataset.section] !== false;
    });
    setActive("alignButtons", state.align);
    setActive("intensityButtons", state.intensity);
  }

  function setActive(groupId, value) {
    document.querySelectorAll("#" + groupId + " button").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.value === value);
    });
  }

  function updatePreview() {
    var theme = themeMap[state.surfaceTheme];
    document.documentElement.style.setProperty("--accent", state.accentColor);
    report.style.setProperty("--report-accent", state.accentColor);
    report.style.setProperty("--report-bg", theme.bg);
    report.style.setProperty("--report-paper", theme.paper);
    report.style.setProperty("--report-ink", theme.ink);
    report.style.setProperty("--report-muted", theme.muted);
    report.style.setProperty("--title-font", JSON.stringify(state.titleFont) + ", serif");
    report.style.setProperty("--body-font", JSON.stringify(state.bodyFont) + ", sans-serif");
    report.style.setProperty("--title-size", state.titleSize + "px");
    report.style.setProperty("--body-size", state.bodySize + "px");
    report.style.setProperty("--report-leading", (state.lineHeight / 100).toFixed(2));
    report.style.setProperty("--content-width", state.contentWidth + "px");
    report.style.setProperty("--card-radius", state.cardRadius + "px");
    report.dataset.layout = state.layoutType;
    report.dataset.align = state.align;
    report.dataset.highlight = state.highlightStyle;
    report.classList.toggle("is-aggressive", state.aggressiveHighlight);
    report.classList.remove("highlight-subtle", "highlight-standard", "highlight-active");
    report.classList.add("highlight-" + state.intensity);
    document.getElementById("previewType").textContent = typeLabels[state.reportType];
    document.querySelectorAll("[data-preview-section]").forEach(function (section) {
      section.hidden = state.sections[section.dataset.previewSection] === false;
    });
    document.getElementById("titleSizeValue").textContent = state.titleSize + "px";
    document.getElementById("bodySizeValue").textContent = state.bodySize + "px";
    document.getElementById("lineHeightValue").textContent = (state.lineHeight / 100).toFixed(2);
    document.getElementById("contentWidthValue").textContent = state.contentWidth + "px";
    document.getElementById("cardRadiusValue").textContent = state.cardRadius + "px";
    setActive("alignButtons", state.align);
    setActive("intensityButtons", state.intensity);
    saveState();
  }

  function bindInput(id, key, convert) {
    var element = document.getElementById(id);
    element.addEventListener("input", function () {
      state[key] = convert ? convert(element.value) : element.value;
      if (id === "skillTitle" && !document.getElementById("skillSlug").dataset.edited) {
        state.skillSlug = slugify(element.value);
        setField("skillSlug", state.skillSlug);
      }
      updatePreview();
    });
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 2600);
  }

  function openModal() {
    state.skillSlug = slugify(state.skillSlug);
    setField("skillSlug", state.skillSlug);
    output.value = buildSkillMarkdown();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    configureInstallButton();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function configureInstallButton() {
    var local = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    var button = document.getElementById("installHermesBtn");
    button.disabled = !local;
    document.getElementById("installHelp").textContent = local
      ? "설치 위치: ~/.hermes/skills/reporting/" + state.skillSlug + "/SKILL.md"
      : "공개 사이트에서는 SKILL.md를 내려받을 수 있습니다. Hermes에 바로 적용하려면 로컬 Studio에서 접속하세요.";
  }

  function downloadSkill() {
    var blob = new Blob([output.value], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "SKILL.md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("SKILL.md를 다운로드했습니다.");
  }

  async function copySkill() {
    try {
      await navigator.clipboard.writeText(output.value);
      showToast("스킬 내용을 복사했습니다.");
    } catch (error) {
      output.select();
      document.execCommand("copy");
      showToast("스킬 내용을 복사했습니다.");
    }
  }

  async function installHermes() {
    var button = document.getElementById("installHermesBtn");
    button.disabled = true;
    button.textContent = "적용 중…";
    try {
      var response = await fetch("/api/skill/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: state.skillSlug, markdown: output.value })
      });
      var result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "설치에 실패했습니다.");
      document.getElementById("installHelp").textContent = "적용 완료: " + result.path;
      button.textContent = "Hermes 적용 완료 ✓";
      showToast("Hermes 스킬에 적용했습니다.");
    } catch (error) {
      button.disabled = false;
      button.textContent = "Hermes에 다시 적용";
      document.getElementById("installHelp").textContent = error.message;
      showToast(error.message);
    }
  }

  ["skillTitle", "skillDescription", "reportType", "layoutType", "accentColor", "highlightStyle", "titleFont", "bodyFont", "surfaceTheme"].forEach(function (key) {
    bindInput(key, key);
  });
  ["titleSize", "bodySize", "lineHeight", "contentWidth", "cardRadius"].forEach(function (key) {
    bindInput(key, key, Number);
  });
  bindInput("skillSlug", "skillSlug", slugify);
  document.getElementById("skillSlug").addEventListener("input", function () {
    this.dataset.edited = "true";
  });
  document.getElementById("accentColor").addEventListener("input", function () {
    setField("accentHex", this.value);
  });
  document.getElementById("accentHex").addEventListener("input", function () {
    var value = this.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      state.accentColor = value;
      setField("accentColor", value);
      updatePreview();
    }
  });
  document.getElementById("accentHex").addEventListener("change", function () {
    if (!/^#[0-9a-f]{6}$/i.test(this.value.trim())) {
      setField("accentHex", state.accentColor);
      showToast("색상은 #ff5c35 같은 6자리 형식으로 입력하세요.");
    }
  });
  document.getElementById("layoutType").addEventListener("change", function () {
    if (this.value === "dark") {
      state.surfaceTheme = "night";
      setField("surfaceTheme", "night");
      updatePreview();
    }
  });
  document.getElementById("aggressiveHighlight").addEventListener("change", function () {
    state.aggressiveHighlight = this.checked;
    updatePreview();
  });
  document.querySelectorAll("#alignButtons button").forEach(function (button) {
    button.addEventListener("click", function () {
      state.align = button.dataset.value;
      updatePreview();
    });
  });
  document.querySelectorAll("#intensityButtons button").forEach(function (button) {
    button.addEventListener("click", function () {
      state.intensity = button.dataset.value;
      updatePreview();
    });
  });
  document.querySelectorAll("[data-section]").forEach(function (input) {
    input.addEventListener("change", function () {
      state.sections[input.dataset.section] = input.checked;
      updatePreview();
    });
  });
  document.getElementById("resetBtn").addEventListener("click", function () {
    state = clone(defaults);
    localStorage.removeItem(storageKey);
    document.getElementById("skillSlug").removeAttribute("data-edited");
    hydrateControls();
    updatePreview();
    showToast("기본 디자인으로 초기화했습니다.");
  });
  document.getElementById("completeBtn").addEventListener("click", openModal);
  document.getElementById("closeModal").addEventListener("click", closeModal);
  modal.addEventListener("click", function (event) {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });
  document.getElementById("downloadSkillBtn").addEventListener("click", downloadSkill);
  document.getElementById("copySkillBtn").addEventListener("click", copySkill);
  document.getElementById("installHermesBtn").addEventListener("click", installHermes);

  hydrateControls();
  updatePreview();
})();
