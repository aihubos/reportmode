(function () {
  "use strict";

  var storageKey = "reportmode-skill-builder-v43";
  var defaults = {
    skillTitle: "AI Research Report",
    skillSlug: "ai-research-report",
    skillDescription: "웹 리서치와 실제 시각자료를 바탕으로 표, 이모티콘, 인포그래픽이 포함된 출처 중심 HTML 보고서를 만듭니다.",
    deliveryMode: "github",
    githubRepo: "",
    previewView: "detail",
    depthMode: "simple",
    documentStyle: "toss",
    palette: "toss-lemon",
    reportType: "product",
    layoutType: "minimal",
    align: "left",
    visualStyle: "whiteboard",
    generateInfographic: true,
    useRealPhotos: true,
    useOfficialLogos: true,
    useSubagents: true,
    researchModel: "openai/gpt-5.6-terra",
    highlightStyle: "marker",
    intensity: "standard",
    aggressiveHighlight: true,
    titleFont: "Noto Sans KR",
    bodyFont: "Noto Sans KR",
    titleSize: 72,
    bodySize: 17,
    lineHeight: 172,
    contentWidth: 960,
    cardRadius: 18,
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
    executive: "경영진이 빠르게 결정할 수 있도록 결론, 핵심 수치, 위험, 권고 행동을 먼저 제시한다.",
    market: "시장 규모, 경쟁 구도, 고객 변화, 기회와 위협을 비교하고 모든 수치의 기준 시점과 출처를 표시한다.",
    technical: "구조, 작동 원리, 구현 선택지, 한계와 운영 영향을 기술하되 비전문가도 이해할 수 있는 설명을 함께 쓴다.",
    research: "여러 원문의 공통점과 충돌점을 묶고 사실, 분석, 전망을 명확히 구분한 리서치 다이제스트를 만든다."
  };

  var depthRules = {
    simple: {
      label: "일반 보고서",
      preview: "일반 보고서 · 간단 2페이지 + 상세",
      rule: "핵심 판단과 근거를 빠르게 읽을 수 있게 작성하되, 웹에서는 간단 보기와 상세 보기를 함께 제공한다. 간단 PDF는 검증된 내용으로 채운 정확히 A4 2페이지다."
    },
    deep: {
      label: "심층보고서모드",
      preview: "심층보고서모드 · 상세 분석",
      rule: "매우 상세하게 작성한다. 조사 질문과 방법, 산업·기업 배경, 핵심 데이터, 경쟁 비교, 근거별 찬반 논리, 반대 관점, 세 가지 이상 시나리오, 리스크, 실행 조건, 한계, 상세 결론, 출처 신뢰도까지 포함한다. 임의로 분량을 부풀리지 말고 추가 근거로 깊이를 만든다."
    }
  };

  var layoutLabels = {
    magazine: "따뜻한 매거진",
    whitepaper: "기업 백서",
    editorial: "강한 에디토리얼",
    minimal: "절제된 문서",
    dark: "프리미엄 다크"
  };

  var documentStyles = {
    toss: {
      label: "Toss Clean",
      bg: "#f5f7fa",
      paper: "#ffffff",
      ink: "#191f28",
      muted: "#6b7684",
      palette: "toss-lemon",
      layout: "minimal",
      titleFont: "Noto Sans KR",
      bodyFont: "Noto Sans KR"
    },
    ultraviolet: {
      label: "Ultra Violet",
      bg: "#f7f5ff",
      paper: "#ffffff",
      ink: "#1d1830",
      muted: "#746d86",
      palette: "violet-lavender",
      layout: "whitepaper",
      titleFont: "Noto Serif KR",
      bodyFont: "IBM Plex Sans KR"
    },
    dark: {
      label: "Dark Mode",
      bg: "#0f1115",
      paper: "#171a21",
      ink: "#f7f7f2",
      muted: "#a2a7b2",
      palette: "coral-peach",
      layout: "dark",
      titleFont: "Noto Serif KR",
      bodyFont: "IBM Plex Sans KR"
    },
    neon: {
      label: "Neon Signal",
      bg: "#060908",
      paper: "#0c1210",
      ink: "#eafff5",
      muted: "#88a99a",
      palette: "neon-pink",
      layout: "editorial",
      titleFont: "IBM Plex Sans KR",
      bodyFont: "IBM Plex Sans KR"
    },
    editorial: {
      label: "Editorial Paper",
      bg: "#f4efe4",
      paper: "#fffdf7",
      ink: "#1c1b17",
      muted: "#716d63",
      palette: "coral-peach",
      layout: "magazine",
      titleFont: "Noto Serif KR",
      bodyFont: "Noto Sans KR"
    }
  };

  var palettes = {
    "toss-lemon": { label: "블루 · 레몬", accent: "#3182f6", mark: "#ffe066" },
    "violet-lavender": { label: "보라 · 라벤더", accent: "#6d28d9", mark: "#e9d5ff" },
    "coral-peach": { label: "코랄 · 피치", accent: "#ff5c35", mark: "#ffd8cc" },
    "forest-lime": { label: "포레스트 · 라임", accent: "#146c43", mark: "#b7f36b" },
    "navy-cyan": { label: "네이비 · 시안", accent: "#0b3d91", mark: "#6de8ff" },
    "neon-pink": { label: "네온 · 핑크", accent: "#2cff9a", mark: "#ff2bd6" }
  };

  var visualStyleLabels = {
    whiteboard: "순백색 한글 화이트보드 두들"
  };

  var researchModelLabels = {
    "openai/gpt-5.6-terra": "Terra",
    "openai/gpt-5.6-luna": "Luna"
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
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (error) { /* storage may be blocked in local previews */ }
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
      sources: "문서 최하단의 전체 자료 출처"
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
      band: "핵심어 배경 전체를 컬러 밴드로 채운다",
      leftbar: "핵심 문장 왼쪽에 굵은 세로 강조선을 둔다"
    };
    var intensities = {
      subtle: "은은한 강도, 투명도 약 28%",
      standard: "표준 강도, 투명도 약 72%",
      active: "강한 강도, 글자 높이의 약 80%"
    };
    return styles[state.highlightStyle] + ". " + intensities[state.intensity] + ". " +
      (state.aggressiveHighlight
        ? "핵심 수치, 최종 판단, 위험 경고, 섹션별 핵심어에 적극 적용하되 한 문단에 두 번을 넘기지 않는다."
        : "표지나 최종 판단 등 문서 전체에서 3~5곳에만 절제해 적용한다.");
  }

  function visualRules() {
    var rules = [];
    if (state.generateInfographic) {
      rules.push("보고서 작성 후 핵심 내용을 바탕으로 " + visualStyleLabels[state.visualStyle] + " 인포그래픽을 실제 이미지 생성 도구로 만든다. 프롬프트만 작성하고 끝내지 않는다.");
      rules.push("이미지는 순백색 배경, 깔끔한 검은 손그림, 제한된 포인트색, 짧고 큰 한글, 왼쪽 위 RM 원형 로고와 리포트 모드 표기를 사용한다. 보고서 내용에 맞춰 두들 배치와 정보 구조만 바꾼다.");
    } else {
      rules.push("사용자가 이미지 생성을 요청한 경우에만 인포그래픽을 실제 생성한다.");
    }
    if (state.useRealPhotos) {
      rules.push("기업·제품의 실제 사진을 웹 검색한다. 공식 미디어 자료 또는 재사용 허용 라이선스 사진을 우선하고 출처·저작자·라이선스를 기록한다.");
    }
    if (state.useOfficialLogos) {
      rules.push("기업·제품 로고는 AI로 비슷하게 그리지 말고 공식 브랜드 사이트나 미디어킷에서 확보한다. 해당 브랜드의 사용 지침이 허용하는 경우에만 실제 로고를 사용한다.");
    }
    return rules;
  }

  function buildSkillMarkdown() {
    var tick = String.fromCharCode(96);
    var dateExample = "YYMMDD-english-slug.html";
    var sections = selectedSections();
    var style = documentStyles[state.documentStyle];
    var palette = palettes[state.palette];
    var visuals = visualRules();
    if (!sections.length) sections = ["제목, 본문, 문서 최하단의 전체 출처"];

    var lines = [
      "---",
      "name: " + slugify(state.skillSlug),
      "description: " + yamlText(state.skillDescription),
      "version: 4.3.0",
      "---",
      "",
      "# " + (state.skillTitle || "Custom Report Skill"),
      "",
      "검증 가능한 웹 자료와 실제 시각자료를 사용해 독립형 HTML 보고서를 완성하라.",
      "",
      "## 결과물",
      "",
      "- 브라우저에서 바로 열 수 있는 독립형 HTML 파일 1개를 만든다.",
      "- 파일명은 한국시간 생성일 기준 " + tick + dateExample + tick + "로 만든다.",
      "- 화면에는 " + tick + "YYMMDD · 보고서 제목" + tick + ", 본문에는 " + tick + "YYYY.MM.DD KST" + tick + "를 표시한다.",
      "- CSS를 HTML 안에 포함하고 PC, 390px 모바일, 인쇄 화면을 지원한다.",
      "- 조사에 사용한 기사, 데이터, 로고, 사진, 생성 이미지를 문서 최하단 출처 표에 모두 기록한다.",
      "",
      "## 배포 대상 확인",
      "",
      "- 선택된 기본 전달 방식: " + (state.deliveryMode === "github" ? "사용자 지정 GitHub Pages" : "다운로드 가능한 로컬 웹페이지"),
      state.deliveryMode === "github" && state.githubRepo
        ? "- 기본 저장소 후보: " + state.githubRepo + ". 배포 전에 소유자, 기본 브랜치, push 권한, Pages 설정과 공개 주소를 실제 확인한다."
        : "- 요청에 GitHub 저장소가 없으면 URL 또는 owner/repo를 한 번 입력받는다. GitHub가 없다고 하면 로컬 전달로 전환한다.",
      "- 사용자가 지정하지 않은 제3자 저장소를 기본값으로 사용하거나 사용자 승인 없이 게시하지 않는다.",
      "- GitHub가 없는 사용자는 index.html, 상대 자산, report-package.zip을 만들고 보고서 폴더만 127.0.0.1의 빈 포트에서 제공한다.",
      "- 완료 응답에는 GitHub 모드면 공개 URL·저장소·브랜치·commit SHA를, 로컬 모드면 HTML·ZIP 경로·loopback 보기와 다운로드 주소·서버 종료 방법을 제공한다.",
      "- 로컬 URL은 서버가 실행 중인 해당 컴퓨터에서만 열 수 있으며 공개 배포가 아니라고 명확히 표시한다.",
      "",
      "## 보고서 깊이",
      "",
      "- 선택 모드: " + depthRules[state.depthMode].label,
      "- " + depthRules[state.depthMode].rule,
      "- 사용자가 요청에서 일반 보고서 또는 심층보고서모드를 명시하면 이 기본값보다 사용자 요청을 우선한다.",
      "",
      "## 분석 타입",
      "",
      "- 타입: " + typeLabels[state.reportType],
      "- " + typeRules[state.reportType],
      "",
      "## Hermes 서브에이전트 오케스트레이션",
      "",
      state.useSubagents
        ? "- 자료조사에 delegate_task 서브에이전트를 반드시 적극 사용한다."
        : "- 사용자가 명시적으로 요청한 경우에만 delegate_task를 사용한다.",
      "- 최종 취합과 보고서 작성은 openai/gpt-5.6-sol을 사용하는 부모 에이전트가 맡는다.",
      "- 조사 자식 권장 모델: " + state.researchModel + " (" + researchModelLabels[state.researchModel] + "). Hermes config.yaml의 delegation.model이 이 값과 일치해야 실제 적용된다.",
      "- Hermes의 delegate_task는 작업마다 model 인자를 받지 않는다. 실제 자식 모델은 config.yaml의 delegation.model을 사용하므로 지원하지 않는 model 인자를 만들지 않는다.",
      "- 일반 보고서는 두 자식을 한 batch로 실행한다: (1) 공식 자료·핵심 사실, (2) 시장·경쟁·시각자료·라이선스.",
      "- 표준 심층은 공식 상태·독립 실측/반대근거·시장/반응/시각 권리의 세 자식을 한 batch로 실행한다. 결론을 바꾸는 누락이 있을 때만 보강 자식 1개를 추가한다.",
      "- 각 자식에게 주제, 기간, 독자, 담당 범위, 금지 추측, 필요한 출력 형식을 context에 완전하게 전달한다. 자식은 부모 대화 내용을 알지 못한다고 가정한다.",
      "- 각 자식의 결과는 주장, 근거 URL, 발행일, 확인일, 출처 유형, 사실/분석/전망/루머, 상충 내용, 시각자료 URL과 라이선스를 담은 evidence pack으로 받는다.",
      "- 서브에이전트에게 최종 보고서 작성이나 서로의 결과 리뷰를 맡기지 않는다. Sol 부모가 중복 제거, 충돌 표시, 최종 판단, HTML 작성과 이미지 생성을 책임진다.",
      "- 일부 자식이 실패하면 해당 범위를 한 번 재시도한다. 끝내 실패하면 누락 범위를 최종 보고서에 명시한다.",
      "",
      "## 이미지 생성 의무",
      ""
    ];
    visuals.forEach(function (rule) {
      lines.push("- " + rule);
    });
    lines = lines.concat([
      "- 인포그래픽 목적, 독자, 화면 비율, 핵심 피사체, 구성, 스타일, 색감, 정확한 문구, 금지 조건을 구조화해 이미지 생성 도구에 전달한다.",
      "- 이미지에는 확인된 숫자와 짧은 문구만 넣고 가짜 수치, 깨진 한글, 임의 문구를 금지한다.",
      "- 모든 이미지 문구는 한글을 기본으로 하고 readable Korean typography, no garbled Hangul, large clean Korean text를 프롬프트에 포함한다.",
      "- 생성 뒤 텍스트, 숫자, 고유명사, 잘림, 중복 오브젝트를 확인하고 문제가 있으면 최소 한 번 다시 생성하거나 보정한다.",
      "- 실제 이미지 파일을 HTML 상단에 넣고 " + tick + "AI 생성 인포그래픽 · 공식 제품 이미지 아님" + tick + "을 표시한다.",
      "- 이미지 생성 도구가 없거나 호출에 실패하면 생성한 척하지 말고 실제 오류를 알린다.",
      "",
      "## 실제 사진과 로고",
      "",
      "- 기업 또는 제품 리서치에서는 웹 검색으로 공식 로고와 실제 제품 사진을 적극 찾는다.",
      "- 로고는 공식 브랜드 사이트 또는 공식 미디어킷을 우선한다. 공식 사용 지침을 확인하고 허용 범위 안에서만 사용한다.",
      "- 상표 지침이 로고 사용을 허용하지 않으면 그래픽 로고를 넣지 말고 회사명 워드마크와 독립 보고서 고지를 사용한다.",
      "- 실제 제품이 공식 발표되지 않았다면 렌더, 콘셉트, 유출 주장, 더미 모델을 실제 제품 사진이라고 부르지 않는다.",
      "- 다른 회사의 실제 제품 사진을 비교 자료로 쓸 때는 제품명을 명확히 밝히고 연구 대상 제품처럼 보이지 않게 한다.",
      "- 재사용 권한을 확인할 수 없는 사진은 다운로드해 재배포하지 말고 원문 링크 카드만 제공한다.",
      "",
      "## 디자인 계약",
      "",
      "- 전체 문서 스타일: " + style.label + " (" + state.documentStyle + ")",
      "- 사용자가 요청에서 다른 시각 스타일을 명시하면 선택된 기본 모드보다 사용자 요청을 우선한다.",
      "- 편집 레이아웃: " + layoutLabels[state.layoutType] + " (" + state.layoutType + ")",
      "- 표지 정렬: " + state.align,
      "- 제목 폰트: " + state.titleFont + ", 대체 글꼴 serif",
      "- 본문 폰트: " + state.bodyFont + ", 대체 글꼴 sans-serif",
      "- 표지 제목 크기: 데스크톱 " + state.titleSize + "px, 모바일에서는 clamp로 축소",
      "- 본문 크기: " + state.bodySize + "px",
      "- 본문 줄 간격: " + (state.lineHeight / 100).toFixed(2),
      "- 콘텐츠 최대 폭: " + state.contentWidth + "px",
      "- 카드 모서리: " + state.cardRadius + "px",
      "- 페이지 배경색: " + style.bg,
      "- 문서 배경색: " + style.paper,
      "- 본문 글자색: " + style.ink,
      "- 보조 글자색: " + style.muted,
      "- 포인트색: " + palette.accent,
      "- 밑줄·마커 하이라이트색: " + palette.mark,
      "- 본문 글자색과 밑줄·마커색을 같은 값으로 쓰지 않는다.",
      "- 상단에는 큰 pill형 간단·상세 segmented control과 별도 PDF 저장 버튼을 둔다. 버튼은 aria-pressed, 키보드 포커스, prefers-reduced-motion을 지원한다.",
      "- h1 바로 아래에 핵심 판단·결정 근거·행동/주의의 정확히 3줄 핵심 결론을 두고, 각 줄의 핵심 문구 하나만 강조한다.",
      "- 쿼리 없는 최초 진입은 상세 보기다. `?view=simple` 또는 간단 버튼을 선택하면 제목·핵심 결론 3줄·리드·배경·핵심 비교·선택 기준·주의점/다음 행동을 A4 2페이지로 압축한 간단 보기를 제공한다.",
      "- 상세 보기는 전체 본문, 실제 인터넷·언론 반응과 기본 닫힘 상태의 전체 출처를 제공한다. PDF 저장은 현재 선택한 보기를 출력한다.",
      "- 인터넷·언론 반응은 접근 가능한 공개 원문 3~6개를 긍정·비판·유보로 균형 있게 제시하고 개인 의견을 전체 여론처럼 확대하지 않는다.",
      "",
      "## 하이라이트·표·이모티콘",
      "",
      "- 팔레트: " + palette.label,
      "- " + highlightRule(),
      "- 포인트색 " + palette.accent + "은 제목, 표 헤더, 아이콘에 쓰고 하이라이트색 " + palette.mark + "은 밑줄과 마커에만 쓴다.",
      "- 사양, 수치 비교, 경쟁사 비교, 시나리오, 출처는 가능한 한 실제 HTML 표로 구성한다.",
      "- 섹션 제목과 상태 표시에 🧭 📱 📊 ✅ ⚠️ 🔎 🧾 같은 이모티콘을 적극 사용한다.",
      "- 이모티콘은 정보 탐색을 돕는 용도로만 쓰고 문장마다 반복하거나 장식처럼 남발하지 않는다.",
      "",
      "## 필수 섹션",
      ""
    ]);
    sections.forEach(function (section) {
      lines.push("- " + section);
    });
    if (state.depthMode === "deep") {
      lines = lines.concat([
        "- 조사 질문과 조사 방법",
        "- 산업·기업·제품 배경",
        "- 경쟁사 및 대안 비교표",
        "- 낙관·기준·보수 시나리오 표",
        "- 반대 논리와 실패 가능성",
        "- 리스크, 실행 조건, 한계, 추가 확인 과제",
        "- 출처별 신뢰도와 상충 지점"
      ]);
    }
    lines = lines.concat([
      "",
      "## 근거 규칙",
      "",
      "1. 사용자가 제공한 URL과 검색으로 선택한 핵심 URL을 직접 확인한다.",
      "2. 공식 발표, 언론 보도, 공급망 정보, 개인 의견을 섞지 않는다.",
      "3. 중요한 문장은 사실, 분석, 전망, 루머 중 성격이 드러나게 쓴다.",
      "4. 상충하는 수치는 임의로 합치지 말고 범위와 충돌 사실을 함께 적는다.",
      "5. 기사 전문을 복제하지 않고 제목, 발행처, URL, 발행일, 확인일만 남긴다.",
      "6. 원문에 없는 내용을 사실처럼 만들지 않는다. 불확실하면 불확실하다고 쓴다.",
      "7. 한국어는 짧고 명확하게 쓰고 필요한 전문용어는 바로 풀어서 설명한다.",
      "",
      "## 제작 순서",
      "",
      "1. 주제, 목적, 독자, 언어, 보고서 깊이, 사용자 지정 스타일을 정리한다.",
      "2. 웹 검색으로 공식 자료, 기사, 실제 사진, 로고 사용 지침을 수집한다.",
      "3. 사실, 분석, 전망, 루머와 상충 지점을 분리한다.",
      "4. 선택한 깊이 규칙에 맞춰 결론, 목차, 표 구조를 만든다.",
      "5. 보고서 내용을 요약한 상단 인포그래픽을 실제 생성하고 검수한다.",
      "6. 허용되는 실제 로고와 제품 사진을 출처 고지와 함께 배치한다.",
      "7. 디자인 토큰, 표, 이모티콘, 하이라이트를 적용해 HTML을 만든다.",
      "8. 문서 최하단에 전체 자료 출처 표를 넣는다.",
      "9. 모바일, 인쇄, 링크, 이미지 경로, 출처 누락을 확인한다.",
      "",
      "## 최하단 전체 출처 표",
      "",
      "문서의 마지막 요소는 기본 닫힘 상태의 details#sources로 끝내고, 그 안의 전체 출처 표는 " + tick + "유형 | 자료명 | 제공자·저작자 | 원문 | 날짜 | 라이선스·상태 | 사용 범위" + tick + "로 구성하라.",
      "기사·논문·공식 문서뿐 아니라 로고, 실제 사진, 더미 사진 링크, AI 생성 이미지와 생성일도 모두 포함하라.",
      "",
      "## Apple 폴더블 예시",
      "",
      "- Apple이 공식 발표하지 않은 동안에는 " + tick + "공식 발표 전" + tick + "을 표시한다.",
      "- 유출 주장이나 물리 더미 사진은 " + tick + "더미 모델" + tick + "로 표시하고 실제 판매 제품 사진으로 부르지 않는다.",
      "- 실제 Galaxy Z Fold 사진을 쓰면 Apple 제품이 아니라 폴더블 폼팩터 비교 자료임을 크게 밝힌다.",
      "- Apple의 상표 지침이 그래픽 로고 사용을 허용하지 않는 독립 보고서에서는 Apple 로고 대신 회사명과 비후원 고지를 쓴다.",
      "",
      "## 완료 응답",
      "",
      "- 공개 또는 로컬 보고서 URL",
      "- 다운로드 가능한 HTML 또는 ZIP",
      "- 조사·작성·검수·배포의 실제 벽시계 시간과 사용 모델",
      "- HTTP 200, 이미지, 390px, 간단 2페이지 PDF, 상세 PDF와 출처 검증 결과",
      "- 확인하지 못한 내용 또는 남은 불확실성",
      ""
    ]);
    return lines.join("\n");
  }

  function setField(id, value) {
    var element = document.getElementById(id);
    if (element) element.value = value;
  }

  function setActive(groupId, value) {
    document.querySelectorAll("#" + groupId + " button").forEach(function (button) {
      var active = button.dataset.value === value;
      button.classList.toggle("is-active", active);
      if (button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", String(active));
    });
  }

  function hydrateControls() {
    ["skillTitle", "skillSlug", "skillDescription", "githubRepo", "reportType", "layoutType", "visualStyle", "researchModel", "highlightStyle", "titleFont", "bodyFont", "titleSize", "bodySize", "lineHeight", "contentWidth", "cardRadius"].forEach(function (key) {
      setField(key, state[key]);
    });
    document.getElementById("aggressiveHighlight").checked = state.aggressiveHighlight;
    document.getElementById("generateInfographic").checked = state.generateInfographic;
    document.getElementById("useRealPhotos").checked = state.useRealPhotos;
    document.getElementById("useOfficialLogos").checked = state.useOfficialLogos;
    document.getElementById("useSubagents").checked = state.useSubagents;
    document.querySelectorAll("[data-section]").forEach(function (input) {
      input.checked = state.sections[input.dataset.section] !== false;
    });
    setActive("depthButtons", state.depthMode);
    setActive("deliveryButtons", state.deliveryMode);
    setActive("previewViewButtons", state.previewView);
    setActive("documentStyleButtons", state.documentStyle);
    setActive("paletteButtons", state.palette);
    setActive("alignButtons", state.align);
    setActive("intensityButtons", state.intensity);
  }

  function updatePreview() {
    var style = documentStyles[state.documentStyle];
    var palette = palettes[state.palette];
    document.documentElement.style.setProperty("--accent", palette.accent);
    report.style.setProperty("--report-accent", palette.accent);
    report.style.setProperty("--report-mark", palette.mark);
    report.style.setProperty("--report-bg", style.bg);
    report.style.setProperty("--report-paper", style.paper);
    report.style.setProperty("--report-ink", style.ink);
    report.style.setProperty("--report-muted", style.muted);
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
    report.dataset.documentStyle = state.documentStyle;
    report.dataset.depth = state.depthMode;
    report.dataset.reportView = state.previewView;
    report.classList.toggle("is-aggressive", state.aggressiveHighlight);
    report.classList.remove("highlight-subtle", "highlight-standard", "highlight-active");
    report.classList.add("highlight-" + state.intensity);
    document.getElementById("previewType").textContent = typeLabels[state.reportType];
    document.getElementById("previewDepth").textContent = depthRules[state.depthMode].preview;
    document.querySelectorAll("[data-preview-section]").forEach(function (section) {
      section.hidden = state.sections[section.dataset.previewSection] === false;
    });
    document.querySelectorAll("[data-depth-only]").forEach(function (section) {
      section.hidden = state.depthMode !== section.dataset.depthOnly || state.previewView !== section.dataset.viewOnly;
    });
    document.querySelectorAll("[data-view-only]:not([data-depth-only])").forEach(function (section) {
      section.hidden = state.previewView !== section.dataset.viewOnly;
    });
    document.querySelectorAll("[data-preview-visual='infographic']").forEach(function (element) {
      element.hidden = !state.generateInfographic;
    });
    document.querySelectorAll("[data-preview-visual='realPhoto']").forEach(function (element) {
      element.hidden = !state.useRealPhotos || (element.dataset.viewOnly && state.previewView !== element.dataset.viewOnly);
    });
    document.querySelectorAll("[data-preview-visual='officialLogo']").forEach(function (element) {
      element.hidden = !state.useOfficialLogos;
    });
    document.getElementById("titleSizeValue").textContent = state.titleSize + "px";
    document.getElementById("bodySizeValue").textContent = state.bodySize + "px";
    document.getElementById("lineHeightValue").textContent = (state.lineHeight / 100).toFixed(2);
    document.getElementById("contentWidthValue").textContent = state.contentWidth + "px";
    document.getElementById("cardRadiusValue").textContent = state.cardRadius + "px";
    setActive("depthButtons", state.depthMode);
    setActive("deliveryButtons", state.deliveryMode);
    setActive("previewViewButtons", state.previewView);
    setActive("documentStyleButtons", state.documentStyle);
    setActive("paletteButtons", state.palette);
    setActive("alignButtons", state.align);
    setActive("intensityButtons", state.intensity);
    document.getElementById("githubRepoField").hidden = state.deliveryMode !== "github";
    document.getElementById("deliveryNote").textContent = state.deliveryMode === "github"
      ? "사용자가 지정하지 않은 저장소에는 게시하지 않습니다."
      : "index.html·자산·ZIP과 127.0.0.1 로컬 주소를 생성합니다.";
    saveState();
  }

  function applyDocumentStyle(value) {
    var style = documentStyles[value];
    state.documentStyle = value;
    state.palette = style.palette;
    state.layoutType = style.layout;
    state.titleFont = style.titleFont;
    state.bodyFont = style.bodyFont;
    setField("layoutType", state.layoutType);
    setField("titleFont", state.titleFont);
    setField("bodyFont", state.bodyFont);
    updatePreview();
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

  function bindToggle(id, key) {
    document.getElementById(id).addEventListener("change", function () {
      state[key] = this.checked;
      updatePreview();
    });
  }

  function bindButtonGroup(groupId, key, callback) {
    document.querySelectorAll("#" + groupId + " button").forEach(function (button) {
      button.addEventListener("click", function () {
        if (callback) callback(button.dataset.value);
        else {
          state[key] = button.dataset.value;
          updatePreview();
        }
      });
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
    button.textContent = "Hermes에 바로 적용";
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

  ["skillTitle", "skillDescription", "githubRepo", "reportType", "layoutType", "visualStyle", "researchModel", "highlightStyle", "titleFont", "bodyFont"].forEach(function (key) {
    bindInput(key, key);
  });
  ["titleSize", "bodySize", "lineHeight", "contentWidth", "cardRadius"].forEach(function (key) {
    bindInput(key, key, Number);
  });
  bindInput("skillSlug", "skillSlug", slugify);
  document.getElementById("skillSlug").addEventListener("input", function () {
    this.dataset.edited = "true";
  });
  bindToggle("aggressiveHighlight", "aggressiveHighlight");
  bindToggle("generateInfographic", "generateInfographic");
  bindToggle("useRealPhotos", "useRealPhotos");
  bindToggle("useOfficialLogos", "useOfficialLogos");
  bindToggle("useSubagents", "useSubagents");
  bindButtonGroup("depthButtons", "depthMode");
  bindButtonGroup("deliveryButtons", "deliveryMode");
  bindButtonGroup("previewViewButtons", "previewView");
  bindButtonGroup("documentStyleButtons", "documentStyle", applyDocumentStyle);
  bindButtonGroup("paletteButtons", "palette");
  bindButtonGroup("alignButtons", "align");
  bindButtonGroup("intensityButtons", "intensity");

  document.querySelectorAll("[data-section]").forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.dataset.section === "sources") {
        input.checked = true;
        state.sections.sources = true;
        showToast("전체 출처는 모든 보고서에 필수입니다.");
      } else {
        state.sections[input.dataset.section] = input.checked;
      }
      updatePreview();
    });
  });
  document.getElementById("resetBtn").addEventListener("click", function () {
    state = clone(defaults);
    try { localStorage.removeItem(storageKey); } catch (error) { /* storage may be blocked */ }
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
  document.getElementById("previewPdfBtn").addEventListener("click", function () {
    window.print();
  });

  hydrateControls();
  updatePreview();
})();
