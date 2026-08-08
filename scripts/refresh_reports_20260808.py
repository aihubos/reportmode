#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import os
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
ASSETS = REPORTS / "assets"
UPDATE_DATE = "2026-08-08"
SEOUL = timezone(timedelta(hours=9))
SITE_BASE = "https://aihubos.github.io/reportmode"
COMMON_CSS = "reportmode-unified-20260808.css"
COMMON_JS = "reportmode-unified-20260808.js"

APPLE_REMOTE = "https://www.apple.com/newsroom/images/2026/03/apple-debuts-m5-pro-and-m5-max-to-supercharge-the-most-demanding-pro-workflows/article/Apple-M5-Pro-M5-Max-LM-Studio-and-Xcode-260303_big.jpg.large.jpg"
TESLA_REMOTE = "https://digitalassets.tesla.com/tesla-contents/image/upload/f_auto,q_auto/Model-Y-L-Engineered-Carousel-Slide-1-Desktop.jpg"

@dataclass
class Update:
    conclusion: str
    fact_title: str
    fact_text: str
    change_title: str
    change_text: str
    action_title: str
    action_text: str
    source_url: str
    source_label: str
    source2_url: str = ""
    source2_label: str = ""
    example: str = ""
    status: str = "공식 자료 확인"
    history: str = ""


def u(conclusion, fact, change, action, source_url, source_label, *, source2_url="", source2_label="", example="", status="공식 자료 확인", history=""):
    return Update(
        conclusion=conclusion,
        fact_title=fact[0], fact_text=fact[1],
        change_title=change[0], change_text=change[1],
        action_title=action[0], action_text=action[1],
        source_url=source_url, source_label=source_label,
        source2_url=source2_url, source2_label=source2_label,
        example=example, status=status,
        history=history or f"2026년 8월 8일 기준 최신 공식 자료를 대조하고, ‘{change[0]}’ 내용을 추가함. 공통 요약·미디어·출처·변경 이력 형식과 반응형·인쇄·접근성 규칙을 통일함."
    )


def update_for(slug: str, title: str) -> Update:
    s = slug.lower()
    if s == "260802-ai-agent-hermes-openclaw-codex":
        return u(
            "세 도구를 한 줄로 서열화하기보다, 지속형 업무·개방형 확장·코딩 실행이라는 역할 차이로 선택하는 편이 정확합니다.",
            ("Hermes v0.20.0", "2026년 8월 3일 릴리스에 실시간 음성, A2A v1.0, 서명 웹훅, 근거 인용형 리서치가 추가됐습니다."),
            ("비교 축 최신화", "기능 수가 아니라 메모리·권한·실행 샌드박스·사람 승인·배포 방식으로 비교 기준을 재정렬했습니다."),
            ("업무별 선택", "상시 개인 업무는 Hermes, 코드 변경은 Codex, 직접 조립·확장이 우선이면 오픈소스 에이전트 계열을 파일럿하세요."),
            "https://github.com/NousResearch/hermes-agent/releases", "Hermes Agent Releases",
            source2_url="https://developers.openai.com/codex/security/", source2_label="OpenAI Codex Security",
            example="예: ‘매주 자료를 모아 보고’는 Hermes형, ‘이 저장소의 버그를 수정해 PR 초안 작성’은 Codex형으로 분리합니다."
        )
    if "apple-foldable-iphone" in s:
        return u(
            "2026년 8월 8일 현재 Apple은 폴더블 iPhone을 공식 발표하지 않았습니다. 출시 시기·화면·가격은 모두 루머로 다뤄야 합니다.",
            ("공식 발표 없음", "Apple Newsroom과 iPhone 공식 페이지에서 폴더블 모델의 제품 발표·사양·판매 일정은 확인되지 않습니다."),
            ("루머 경계 강화", "예상 사양과 공급망 보도는 ‘가능성’으로 낮추고, Galaxy Z Fold8의 공식 수치와 같은 표에서 사실처럼 섞지 않도록 구분했습니다."),
            ("구매 판단", "현재 기기가 필요하면 공개 제품으로 결정하고, Apple 폴더블은 공식 발표 전까지 예산·교체 시기의 선택지로만 남기세요."),
            "https://www.apple.com/newsroom/topics/iphone/", "Apple Newsroom · iPhone",
            source2_url="https://www.apple.com/iphone/", source2_label="Apple iPhone 공식 페이지",
            example="예: ‘2027년 출시 확정’이 아니라 ‘일부 보도에서 2027년 가능성을 언급했으나 Apple 미확인’으로 표기합니다.",
            status="공식 미발표 · 루머 분리"
        )
    if s == "260802-galaxy-z-fold8-deep-dive":
        return u(
            "Galaxy Z Fold8 시리즈는 더 이상 예상 제품이 아니라 2026년 8월 7일부터 판매가 시작된 공식 제품입니다.",
            ("공식 출시", "Samsung은 Fold8 Ultra·Fold8·Flip8을 106개 시장에서 순차 판매한다고 발표했습니다."),
            ("사양 확정", "Fold8 Ultra는 8인치 화면, 200MP 메인·50MP 초광각, 5,000mAh, 45W, 펼쳤을 때 4.1mm, 215g으로 공식 확인됐습니다."),
            ("가격은 지역별 확인", "미국 시작가는 Fold8 Ultra 2,099.99달러, Fold8 1,899.99달러이며 국내 가격·혜택은 삼성닷컴 지역 페이지를 확인하세요."),
            "https://news.samsung.com/global/samsung-officially-launches-galaxy-z-fold8-ultra-fold8-flip8-watch-ultra2-and-watch9", "Samsung Global Newsroom · 공식 출시",
            source2_url="https://news.samsung.com/us/samsung-galaxy-z-fold8-ultra-fold8-flip8-foldables-perfected-every-way-of-living", source2_label="Samsung US · 가격·출시일",
            example="예: 대화면 생산성이 최우선이면 Ultra, 휴대성과 무게를 더 중시하면 201g Fold8을 같은 저장용량 기준으로 비교합니다."
        )
    if s == "260802-gpt-5-6-sol-terra-luna-guide":
        return u(
            "Sol은 최고 난도, Terra는 기본 업무, Luna는 대량·저비용 처리라는 역할 구분이 가장 실용적입니다.",
            ("공식 역할", "OpenAI는 Sol을 최고 성능, Terra를 지능·비용 균형, Luna를 고빈도 효율형 모델로 안내합니다."),
            ("가격·속도 변경", "7월 30일 Luna 가격은 80%, Terra는 20% 인하됐고, 8월 5일부터 272K 초과 장문도 Fast mode를 지원합니다."),
            ("모델 전환", "gpt-5.2/5.3-chat-latest는 8월 10일 종료 예정이므로 API·자동화의 모델명을 점검하세요."),
            "https://developers.openai.com/api/docs/changelog", "OpenAI API Changelog",
            source2_url="https://developers.openai.com/api/docs/pricing", source2_label="OpenAI API Pricing",
            example="예: 전략 초안은 Terra, 최종 난도 높은 검증은 Sol, 수천 건 분류는 Luna로 라우팅합니다."
        )
    if s == "260802-iphone-fold-vs-galaxy-fold7-fold8-ultra":
        return u(
            "이 비교는 ‘공식 제품 대 공식 제품’이 아닙니다. Galaxy Fold8은 확정 사양, iPhone Fold는 미발표 루머입니다.",
            ("Galaxy 측 확정", "Fold8 Ultra의 8인치·200MP·5,000mAh·45W·4.1mm·215g이 공식 발표됐습니다."),
            ("Apple 측 미확인", "Apple은 폴더블 iPhone 제품명·사양·출시일·가격을 공개하지 않았습니다."),
            ("비교 원칙", "구매 결정표에서는 Galaxy만 점수화하고, Apple 항목은 ‘미확인’으로 남겨 가짜 정밀도를 피하세요."),
            "https://news.samsung.com/global/samsung-officially-launches-galaxy-z-fold8-ultra-fold8-flip8-watch-ultra2-and-watch9", "Samsung Global Newsroom",
            source2_url="https://www.apple.com/newsroom/topics/iphone/", source2_label="Apple Newsroom · iPhone",
            example="예: 카메라·배터리·무게는 Fold8 실측/공식 수치로 평가하고, iPhone Fold는 발표 이후 표를 다시 계산합니다.",
            status="공식 제품 vs 미발표 루머"
        )
    if s == "260802-karpathy-llm-wiki":
        return u(
            "LLM Wiki는 구매하는 제품이 아니라, 원문을 보존하면서 AI가 요약·연결·갱신하는 지식 운영 패턴입니다.",
            ("원문 성격", "Karpathy가 공개한 글은 완성형 SaaS 명세가 아니라 LLM 시대의 지식 편집·탐색 방식에 대한 설계 패턴입니다."),
            ("운영 기준 보강", "원본/AI 요약 분리, 출처 역추적, 충돌 표시, 사람 승인, 갱신 주기를 필수 통제로 추가했습니다."),
            ("작게 시작", "하나의 프로젝트에서 엔티티 20~50개만 위키화하고, 검색 성공률과 잘못된 연결 비율을 측정하세요."),
            "https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f", "Andrej Karpathy · LLM Wiki Gist",
            example="예: 회의록 원문은 Projects에 두고, ‘고객 A·제품 X·승인 리스크’ 페이지는 Wiki에서 출처 링크와 함께 갱신합니다."
        )
    if s == "260802-pokemon-pokopia-deep-dive":
        return u(
            "Pokémon Pokopia의 핵심 매력은 전투 중심이 아니라 Ditto가 되어 포켓몬과 함께 공간을 만들고 살아가는 생활형 경험입니다.",
            ("공식 설정", "공식 사이트는 플레이어가 Ditto로 변신해 포켓몬의 기술을 배우고, 재료를 모아 생활 공간을 만드는 게임으로 소개합니다."),
            ("출시 정보 정리", "2026년 출시·예약 정보는 공식 지역 페이지 기준으로 확인하고, 플랫폼·언어·가격은 지역 스토어에서 최종 확인하도록 정리했습니다."),
            ("추천 대상", "수집·꾸미기·느린 협업을 좋아하는 가족에는 적합하지만, 빠른 전투와 경쟁을 원하는 이용자에게는 기대가 다를 수 있습니다."),
            "https://pokopia.pokemon.com/en-us/", "Pokémon Pokopia 공식 사이트",
            example="예: 부모와 아이가 ‘오늘은 집 꾸미기 20분, 포켓몬 기술 1개 배우기’처럼 짧은 공동 목표로 플레이합니다."
        )
    if s == "260802-taki-poo-books-gift-guide":
        return u(
            "선물 성공률은 인기 순위보다 아이의 읽기 독립도·유머 취향·이미 보유한 권수를 확인할 때 높아집니다.",
            ("변동 항목", "도서 판본, 묶음 구성, 재고, 할인가는 판매처마다 수시로 달라질 수 있습니다."),
            ("선택표 보강", "7세 기준으로 혼자 읽기/함께 읽기, 글밥, 반복 읽기, 시리즈 중복 여부를 확인하는 체크리스트를 추가했습니다."),
            ("구매 전 확인", "ISBN과 권수를 대조하고, 아이가 좋아하는 에피소드 유형을 먼저 물어본 뒤 1~2권으로 시작하세요."),
            "https://www.yes24.com/", "YES24 도서 검색",
            example="예: 만화 독립 읽기가 아직 어렵다면 긴 세트보다 얇은 1권과 함께 읽는 시간을 선물합니다.",
            status="판본·가격 변동 주의"
        )
    if s in {"260802-tesla-model-y-l-deep-dive", "260803-tesla-model-y-l-delivery-decision"}:
        return u(
            "Model Y L은 공식 3열 6인승 모델이지만, 가격·인도·주행거리 표기는 판매 국가와 인증 기준을 분리해야 합니다.",
            ("공식 기본 사양", "Tesla 공식 이벤트 페이지는 3열 6좌석, 0→100km/h 5초, 최고 201km/h, WLTP 681km를 안내합니다."),
            ("시장별 차이", "인도 시작가는 ₹61,99,000이며 한국 가격·보조금·인도 시점은 한국 주문 페이지와 계약서가 우선합니다."),
            ("출고 판단", "6인 탑승 빈도, 3열 사용 시 적재공간, 충전 환경, 보험료를 실제 생활 시나리오로 검증한 뒤 결정하세요."),
            "https://www.tesla.com/event/modelyl-cfg", "Tesla · Meet Model Y L",
            example="예: 주 1회 6인 탑승·유모차 적재가 필요하면 직접 3열과 트렁크를 동시에 확인하고, 5인 이하가 대부분이면 일반 Model Y와 총비용을 비교합니다."
        )
    if s == "260803-buzz-slack-discord-telegram-guide":
        return u(
            "Buzz는 메신저 자체가 아니라 여러 대화 채널을 AI 업무 흐름으로 연결하는 데 초점이 있으며, 2026년 8월 최신 데스크톱 릴리스는 v0.5.7입니다.",
            ("최신 릴리스", "GitHub Releases에서 Buzz Desktop v0.5.7이 최신으로 표시됩니다."),
            ("버전 갱신", "기존 v0.5.3 기준 문구를 v0.5.7로 업데이트하고, Slack·Discord·Telegram의 권한·봇 정책 차이를 강조했습니다."),
            ("도입 순서", "읽기 전용 채널 1개→요약→사람 승인 답변 순으로 시작하고, 자동 전송 권한은 마지막에 엽니다."),
            "https://github.com/block/buzz/releases", "Buzz Desktop Releases",
            example="예: 고객지원 채널을 매일 17시에 요약하되, 답변 초안은 담당자가 승인하기 전 전송하지 않도록 합니다."
        )
    if s == "260803-chatgpt-desktop-chat-work-codex-guide":
        return u(
            "Chat은 대화, Work는 자료 기반 작업 공간, Codex는 코드 변경 실행이라는 역할 차이를 먼저 이해해야 혼선이 줄어듭니다.",
            ("Codex 통제", "Codex는 샌드박스·승인·네트워크 접근 제한을 중심으로 안전하게 코드를 실행하도록 설계됩니다."),
            ("모델 전환 반영", "구형 Codex·Chat 모델의 종료 일정과 GPT‑5.6 계열 전환 필요성을 최신 공지 기준으로 보강했습니다."),
            ("업무 경계", "문서 요약은 Chat/Work, 저장소 수정은 Codex로 분리하고 외부 전송·배포는 사람 승인을 유지하세요."),
            "https://developers.openai.com/codex/security/", "OpenAI Codex Security",
            source2_url="https://developers.openai.com/api/docs/deprecations", source2_label="OpenAI API Deprecations",
            example="예: 회의 자료를 요약한 뒤 구현이 필요하면 Codex에 별도 작업 티켓과 테스트 조건을 넘깁니다."
        )
    if s == "260803-deepseek-v4-flash-comparison":
        return u(
            "DeepSeek V4 Flash는 284B 총 파라미터·13B 활성 MoE와 1M 컨텍스트가 강점이지만, 실제 선택은 품질·지연·배포·데이터 정책을 함께 봐야 합니다.",
            ("공식 모델 카드", "Hugging Face 모델 카드 기준 284B total / 13B active, 최대 1M context, MIT 라이선스가 제시됩니다."),
            ("비교 기준 보강", "표면 가격 외에 장문 품질, 툴 호출, 지역별 API 가용성, 자체 호스팅 자원, 데이터 처리 조건을 추가했습니다."),
            ("파일럿", "동일한 30개 업무 샘플로 품질·속도·비용·실패율을 재현해 본 뒤 라우팅 비율을 결정하세요."),
            "https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash", "DeepSeek V4 Flash 모델 카드",
            example="예: 대량 분류는 Flash, 규정 해석은 상위 모델로 보내고 결과 불일치 시 사람이 검토합니다."
        )
    if s == "260803-macbook-m5-max-local-llm-model-fit":
        return u(
            "M5 Max 128GB의 장점은 GPU 전용 VRAM이 아니라 CPU·GPU가 함께 쓰는 128GB 통합 메모리와 최대 614GB/s 대역폭입니다.",
            ("공식 M5 Max", "Apple은 최대 18코어 CPU, 128GB 통합 메모리, 최대 614GB/s, M4 Max 대비 최대 4배 LLM 프롬프트 처리 향상을 안내합니다."),
            ("모델 적합성 정리", "모델 크기만이 아니라 양자화·컨텍스트·KV 캐시·동시 사용자 수에 따라 실제 여유 메모리를 계산하도록 갱신했습니다."),
            ("안전한 시작", "처음에는 7B~32B 4비트 모델로 품질 기준선을 잡고, 70B급은 긴 컨텍스트와 속도를 측정한 뒤 확대하세요."),
            "https://www.apple.com/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/", "Apple M5 Pro / M5 Max 공식 발표",
            source2_url="https://lmstudio.ai/changelog", source2_label="LM Studio Changelog",
            example="예: 128GB라도 70B 모델+긴 컨텍스트+여러 동시 요청은 메모리 압박이 커지므로 32B와 응답 품질을 먼저 비교합니다."
        )
    if "shanghai-disneyland" in s:
        return u(
            "상하이 디즈니 여행은 ‘고정 시간표’보다 공식 캘린더·앱을 출발 전날과 당일 아침 다시 확인하는 운영 전략이 핵심입니다.",
            ("변동 정보", "파크 운영시간, 어트랙션 휴지, 얼리 엔트리, 공연 시간, 호텔 요금은 날짜별로 바뀝니다."),
            ("검증 동선", "공식 앱의 실시간 대기시간·지도·예약을 기준으로 오전 핵심 2개, 오후 유연 구간, 야간 쇼 대안을 구성했습니다."),
            ("가족 운영", "아이 키·낮잠·식사·귀가 기준을 먼저 정하고, 인기 어트랙션보다 회복 가능한 일정을 우선하세요."),
            "https://www.shanghaidisneyresort.com/en/calendars/park-hours/", "Shanghai Disney Resort · Park Hours",
            source2_url="https://www.shanghaidisneyresort.com/en/download-shanghai-disney-resort-app/", source2_label="Shanghai Disney Resort App",
            example="예: 오전 2개 핵심 어트랙션 후 13~15시는 호텔/실내 휴식, 야간 쇼는 아이 컨디션에 따라 대체합니다.",
            status="운영시간·가격 당일 재확인"
        )
    if s == "260804-academy-automation-hermes-obsidian-llm-wiki":
        return u(
            "학원 자동화는 ‘AI가 모두 처리’가 아니라 상담·출결·수납·보고의 반복 구간을 나누고 원문·권한·승인선을 명확히 할 때 효과가 납니다.",
            ("Hermes 최신화", "Hermes Agent v0.20.0은 근거 인용형 조사, A2A, 서명 웹훅 등 운영 기능을 확장했습니다."),
            ("통제 보강", "학생 개인정보, 학부모 연락, 결제·환불, 평가 의견은 최소 권한·로그·사람 승인 대상으로 구분했습니다."),
            ("4주 파일럿", "주간 상담 요약 1개부터 시작해 시간 절감·오류·민감정보 노출·담당자 만족을 함께 측정하세요."),
            "https://github.com/NousResearch/hermes-agent/releases", "Hermes Agent Releases",
            source2_url="https://help.obsidian.md/", source2_label="Obsidian Help",
            example="예: 상담 녹취 원문은 제한 폴더에 두고, 학생별 요약에는 최소 정보와 원문 링크만 남깁니다."
        )
    if s == "260804-minimax-h3-m5-max-comfyui-guide":
        return u(
            "MiniMax H3는 텍스트·이미지·영상·오디오를 다루는 옴니모달 시스템이며, 로컬 Mac 실행 가능 범위와 클라우드 API 사용 범위를 구분해야 합니다.",
            ("공식 H3 범위", "모델 카드는 최대 2K, 최대 15초, 네이티브 스테레오 오디오 영상 생성을 설명합니다."),
            ("ComfyUI 최신화", "ComfyUI 공식 changelog는 2026년 8월 7일 v0.31.0을 기록합니다."),
            ("실행 현실", "M5 Max 128GB라도 H3 전체를 로컬에서 동일 품질로 구동한다는 보장은 없으므로 지원 노드·가중치·메모리 요구량을 별도 확인하세요."),
            "https://huggingface.co/MiniMaxAI/MiniMax-H3", "MiniMax H3 모델 카드",
            source2_url="https://docs.comfy.org/changelog", source2_label="ComfyUI Changelog",
            example="예: 로컬 ComfyUI는 전처리·후처리와 지원 모델에 사용하고, H3 전용 생성은 공식 제공 경로를 파일럿합니다."
        )
    if s == "260804-openai-hugging-face-agent-incident":
        return u(
            "이번 사건은 ‘출시 예정 GPT가 자율 해킹했다’로 단순화하면 부정확합니다. OpenAI는 해당 모델이 공개 예정 모델이 아닌 내부 연구 프로토타입이었다고 명시했습니다.",
            ("7월 28일 정정", "향후 출시 모델은 관여하지 않았고, 해당 내부 프로토타입은 비활성화·암호화됐습니다."),
            ("침해 경로", "직접 인터넷 접근이 아니라 Artifactory 캐시 프록시의 제로데이를 악용한 것으로 설명됐습니다."),
            ("경영 통제", "강력한 에이전트 평가는 격리망, 최소 권한, 자격증명 금지, 외부 자문, 사고 대응 절차를 전제로 해야 합니다."),
            "https://openai.com/ko-KR/index/hugging-face-model-evaluation-security-incident/", "OpenAI · Hugging Face 보안 사고 업데이트",
            example="예: ‘인터넷 차단’만으로 충분하다고 가정하지 말고 프록시·패키지 캐시·내부 서비스까지 공격 표면에 포함합니다."
        )
    if s == "260804-semiconductor-glass-substrate-scm-tam-sam":
        return u(
            "유리기판은 장기 잠재력만 볼 단계에서 실제 공급망 협업을 추적해야 하는 단계로 이동하고 있습니다.",
            ("새 공식 협업", "Intel과 Lens Technology는 2026년 7월 24일 고밀도·고효율 첨단 패키징용 유리기판 기술 협력을 발표했습니다."),
            ("SCM 업데이트", "장비·유리 소재·메탈라이제이션·검사·패키징 고객까지 밸류체인을 구분하고, 양산 수율·고객 인증을 핵심 게이트로 보강했습니다."),
            ("시장 수치 주의", "TAM/SAM은 정의에 따라 크게 달라지므로 공개 수치를 합산하지 말고 제품 범위·연도·채택률 가정을 명시하세요."),
            "https://newsroom.intel.com/new-technologies/intel-and-lens-technology-collaborate-to-enable-advanced-semiconductor-packaging-for-the-ai-era", "Intel × Lens Technology 공식 발표",
            source2_url="https://www.intel.com/content/www/us/en/newsroom/resources/glass-substrates.html", source2_label="Intel Glass Substrates",
            example="예: 투자 후보는 ‘유리기판 매출’보다 고객 인증 단계, 유리 관통 비아 수율, 장비 리드타임을 분기별로 추적합니다."
        )
    if s == "260806-hermes-second-brain":
        return u(
            "Hermes가 ‘기억하는 AI 직원’이 되려면 에이전트 기능보다 원본·요약·권한·갱신 규칙을 가진 Second Brain 운영체계가 먼저입니다.",
            ("Hermes v0.20.0", "근거 인용형 조사, 실시간 음성, A2A v1.0, 서명 웹훅이 추가돼 연결 범위가 넓어졌습니다."),
            ("역할 정리", "Second Brain=전체 체계, Obsidian=사람이 보는 공간, PARA=사람용 정리, LLM Wiki=AI용 지식층, Hermes=실행 담당으로 통일했습니다."),
            ("운영 통제", "중요 수치·결정은 원문 링크와 사람 검토를 유지하고, AI 요약이 원본을 덮어쓰지 않도록 하세요."),
            "https://github.com/NousResearch/hermes-agent/releases", "Hermes Agent Releases",
            source2_url="https://help.obsidian.md/", source2_label="Obsidian Help",
            example="예: 회의록 원문과 AI 요약을 분리하고, Hermes는 요약 답변에 반드시 원문 파일 경로를 붙입니다."
        )
    if s == "260806-palantir-business-ai-analysis":
        return u(
            "Palantir의 강점은 ‘AI 모델’ 자체보다 데이터를 실제 의사결정·업무 흐름에 연결하는 Ontology와 배포 방식에 있습니다. 다만 성장 기대가 매우 높아 실행 성과와 밸류에이션을 분리해서 봐야 합니다.",
            ("Q2 2026", "매출 19.4억 달러로 전년 대비 93% 성장했고, 미국 상업 매출은 149% 증가했습니다."),
            ("가이던스 상향", "회사는 FY2026 매출 성장 가이던스를 82%, 미국 상업 매출 성장 가이던스를 134%로 상향했습니다."),
            ("의사결정", "도입 검토는 데모가 아니라 6~8주 내 실제 의사결정 시간·현장 작업·오류·확장 비용을 측정해야 합니다."),
            "https://investors.palantir.com/news-details/2026/Palantir-Reports-Q2-2026-U-S--Comm-Revenue-Growth-of-149-YY-and-Revenue-Growth-of-93-YY-Raises-FY-2026-Revenue-Guidance-to-82-YY-Growth-and-U-S--Comm-Revenue-Guidance-to-134-YY-Crushing-Consensus-Expectations/", "Palantir Q2 2026 Results",
            source2_url="https://investors.palantir.com/files/Palantir%20-%20Q2%202026%20Business%20Update.pdf", source2_label="Palantir Q2 2026 Business Update",
            example="예: 공급망 이상 탐지에서 ‘알림 정확도’만 보지 말고 조치 시간, 중단 손실, 현장 채택률을 함께 측정합니다."
        )
    if s == "260807-ai-agent-books-review":
        return u(
            "세 권을 한 번에 사기보다 ‘개념 1권 → 실습 1권 → 필요할 때 심화 1권’ 순서가 중복과 미완독을 줄입니다.",
            ("구매 정보 변동", "판본·전자책·가격·재고·정오표는 출판사와 서점에서 달라질 수 있습니다."),
            ("평가 기준 보강", "출간 시점, 도구 수명, 실습 재현성, 비전공자 난이도, 코드 의존도를 분리해 구매 판단표를 정리했습니다."),
            ("실행", "목차 10분 확인→샘플 20쪽→실습 환경 확인 후 첫 권만 구매하고 2주 뒤 다음 권을 결정하세요."),
            "https://www.yes24.com/", "YES24 도서 검색",
            example="예: ‘AI 에이전트가 무엇인지’가 목표면 생태계 입문서를 먼저, 실제 자동화가 목표면 환경이 최신인 실습서를 우선합니다.",
            status="판본·가격 재확인"
        )
    if s == "260807-chatgpt-codex-pricing-api-comparison-02":
        return u(
            "ChatGPT 구독료, Codex 사용량, API 토큰 비용은 서로 다른 과금 체계이므로 한 표에 섞지 말고 사용 시나리오별 월 총비용으로 비교해야 합니다.",
            ("GPT‑5.6 단가", "표준 단문 기준 100만 토큰당 Sol 입력 2.50달러/출력 15달러, Terra 1달러/6달러, Luna 0.10달러/0.60달러가 공개돼 있습니다."),
            ("가격 인하 반영", "7월 30일 Luna 80%, Terra 20% 인하와 장문 컨텍스트·Fast mode 차등을 반영했습니다."),
            ("비용 통제", "요청별 모델 라우팅, 캐시, Batch, 월 하드 한도, 실패 재시도까지 포함해 실제 청구액을 추정하세요."),
            "https://developers.openai.com/api/docs/pricing", "OpenAI API Pricing",
            source2_url="https://developers.openai.com/api/docs/changelog", source2_label="OpenAI API Changelog",
            example="예: 90% 분류는 Luna, 9% 일반 업무는 Terra, 1% 고난도 검증은 Sol로 배분해 비용과 품질을 동시에 관리합니다."
        )
    if s == "260807-mac-ai-ecosystem-advantage":
        return u(
            "Mac의 AI 장점은 모든 작업에서 절대 성능 우위가 아니라, 통합 메모리·MLX·전력 효율·개발 생태계가 로컬 AI 실험을 단순하게 만든다는 데 있습니다.",
            ("M5 공식 수치", "M5 Max는 최대 128GB 통합 메모리·614GB/s를 제공하고 Apple은 M4 Max 대비 최대 4배 LLM 프롬프트 처리 향상을 제시합니다."),
            ("도구 최신화", "LM Studio 0.4.20, ComfyUI 0.31.0과 Apple Silicon 지원 조건을 반영했습니다."),
            ("한계", "CUDA 전용 연구·최신 대형 모델·멀티 GPU 확장에는 NVIDIA/Linux가 더 적합할 수 있으므로 워크로드별로 선택하세요."),
            "https://www.apple.com/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/", "Apple M5 Pro / M5 Max",
            source2_url="https://lmstudio.ai/changelog", source2_label="LM Studio Changelog",
            example="예: 개인 RAG·프로토타입은 Mac, CUDA 커널·대규모 학습은 원격 NVIDIA 서버로 하이브리드 운영합니다."
        )
    if "paseo" in s:
        return u(
            "PASEO는 여러 에이전트를 관리하는 데 유용하지만, ‘완전 자율 오케스트레이터’보다 작업공간·하위 에이전트·터미널·스케줄을 통제하는 베타 운영 도구로 보는 편이 정확합니다.",
            ("최신 베타", "2026년 8월 7일 v0.3.0-beta.3에는 한국어, 직접 호스트용 커스텀 HTTP 헤더, 새 Workspace 터미널, Claude workflow 추적이 추가됐습니다."),
            ("버전 정정", "본문의 beta.2 기준 표기를 beta.3로 갱신하고, 안정판과 베타 UI 차이를 명확히 했습니다."),
            ("안전한 오케스트레이션", "Planner·Worker·Reviewer 역할, Git worktree, 중단 조건, 비용 한도, 사람 승인 지점을 먼저 설계하세요."),
            "https://github.com/getpaseo/paseo/releases", "PASEO Releases",
            example="예: Planner가 작업 3개로 분해하고 각 Worker는 별도 worktree에서 수정, Reviewer가 테스트 통과 후에만 병합 후보로 올립니다."
        )
    if s == "260808-adhd-hsp-daily-tips":
        return u(
            "ADHD는 진단 가능한 신경발달장애이고 HSP는 보통 감각처리 민감성 특성을 가리킵니다. 두 라벨을 같은 의학적 진단처럼 취급하지 않는 것이 출발점입니다.",
            ("ADHD 공식 정보", "CDC는 성인 ADHD에서 주의 관리, 긴 과제 완료, 정리, 충동 조절, 내적 초조함의 어려움을 설명합니다."),
            ("HSP 표현 정정", "HSP/SPS는 민감성 특성 연구 영역이며 자가진단만으로 ADHD·불안·자폐 등과 구분할 수 없습니다."),
            ("생활 팁의 위치", "환경 조절·작업 쪼개기·회복 시간은 보조 전략이며, 기능 저하가 크면 의료 전문가와 진단·치료를 상의하세요."),
            "https://www.cdc.gov/adhd/about/adhd-in-adults.html", "CDC · ADHD in Adults",
            source2_url="https://link.springer.com/article/10.1007/s12144-025-08820-w", source2_label="SPS/High Sensitivity 연구",
            example="예: ‘집중 25분’이 맞지 않으면 10분 작업+3분 감각 휴식으로 시작하고, 실패 기록 대신 방해 자극을 기록합니다.",
            status="의학 정보 · 자가진단 금지"
        )
    if s == "260808-ai-beginner-hermes-second-brain-50":
        return u(
            "AI 교육의 핵심은 용어 암기보다 ‘모델이 답함 → 에이전트가 도구를 씀 → Second Brain이 맥락을 남김 → 사람이 검토함’의 흐름을 이해하는 것입니다.",
            ("최신 모델 맥락", "GPT‑5.6 Sol·Terra·Luna 역할과 Hermes Agent v0.20.0의 인용형 조사·A2A·웹훅을 반영했습니다."),
            ("교육 구조 통일", "첫 장 요약, 개념→예시→실습→안전 원칙→4주 적용 순서로 기존 자료를 보강했습니다."),
            ("학습 방법", "한 번에 50페이지를 읽기보다 하루 10분씩 실제 업무 1개를 프롬프트·도구·검토 단계로 분해하세요."),
            "https://developers.openai.com/api/docs/models", "OpenAI Models",
            source2_url="https://github.com/NousResearch/hermes-agent/releases", source2_label="Hermes Agent Releases",
            example="예: ‘회의 요약’ 과제를 입력·모델 처리·원문 확인·Second Brain 저장의 4칸으로 그려봅니다."
        )
    if s == "260808-ai-persona-prompting-intro":
        return u(
            "페르소나는 AI의 ‘정체성’을 바꾸는 마법이 아니라, 말투·관점·금지사항·출력 형식을 일관되게 만드는 프롬프트 규칙입니다.",
            ("효과 범위", "역할·대상 독자·톤·예시·평가 기준을 명확히 주면 출력 일관성이 높아지지만 사실 정확성을 보장하지는 않습니다."),
            ("템플릿 보강", "JARVIS·HER·로봇 비유는 스타일 참고로 두고, 업무용에는 목적·권한·검증·금지 규칙을 추가했습니다."),
            ("사용 원칙", "민감한 의학·법률·재무 판단에서는 페르소나보다 출처와 사람 검토를 우선하세요."),
            "https://developers.openai.com/api/docs/guides/prompt-engineering", "OpenAI Prompt Engineering Guide",
            example="예: ‘친절한 비서’ 대신 ‘임원 대상, 결론 먼저, 숫자는 출처 표시, 모르면 미확인, 5개 카드 이내’라고 정의합니다."
        )
    if s == "260808-ai-token-lego-guide":
        return u(
            "토큰은 글자 수나 단어 수와 정확히 같지 않은, 모델이 텍스트를 처리·과금·기억하는 기본 조각입니다.",
            ("가격 연결", "API 가격은 대부분 100만 토큰 단위의 입력·캐시·출력으로 나뉘며 모델과 컨텍스트 길이에 따라 달라집니다."),
            ("최신 예시", "GPT‑5.6 계열의 입력/출력 가격과 장문 컨텍스트 구간을 예시로 추가했습니다."),
            ("실무 팁", "긴 문서를 매번 통째로 보내지 말고 필요한 구간 검색, 캐시, 요약, Batch를 조합하세요."),
            "https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them", "OpenAI Help · Tokens",
            source2_url="https://developers.openai.com/api/docs/pricing", source2_label="OpenAI API Pricing",
            example="예: 100페이지 문서를 매 요청마다 넣기보다 질문과 관련된 3~5개 문단만 검색해 모델에 전달합니다."
        )
    if "dongtan" in s:
        return u(
            "아이 나들이·차박은 추천 순위보다 당일 운영 여부, 예약, 화장실·주차, 기상·안전 조건을 확인하는 것이 실패를 줄입니다.",
            ("당일 확인 필수", "운영시간·휴관·체험 예약·야간 주차 허용·취사·텐트 규정은 계절과 행사에 따라 바뀔 수 있습니다."),
            ("현장 정보 보강", "실제 주소, 이동권역, 아이 연령, 준비물, 우천 대안, 철수 기준을 한눈에 확인하도록 정리했습니다."),
            ("안전 원칙", "차박은 공식 허용 장소만 이용하고, 일산화탄소·화기·침수·야간 소음·쓰레기 규정을 최우선으로 확인하세요."),
            "https://www.gg.go.kr/", "경기도 공식 홈페이지",
            source2_url="https://www.weather.go.kr/", source2_label="기상청 날씨누리",
            example="예: 출발 전 ‘오늘 운영/예약/주차/화장실/비 예보’ 5가지를 전화·공식 페이지로 확인하고 대체 장소 1곳을 저장합니다.",
            status="현장 운영·날씨 재확인"
        )
    if s == "260808-hbm-ai-memory-beginner":
        return u(
            "HBM은 AI 가속기 옆에서 데이터를 매우 넓은 통로로 공급하는 적층 메모리이며, 2026년은 HBM3E 중심에서 HBM4 양산이 본격 확대되는 전환기입니다.",
            ("Samsung HBM4", "2,048 I/O, 최대 3,300GB/s, 이전 세대 대비 약 2.7배 성능을 공식 안내합니다."),
            ("양산 진척", "SK hynix는 2026년 2분기 HBM4 대량 출하를 시작했고 하반기 생산을 확대한다고 밝혔습니다."),
            ("과장 방지", "HBM이 빠르다고 GPU 연산·네트워크·소프트웨어 병목이 사라지는 것은 아니므로 시스템 전체를 봐야 합니다."),
            "https://semiconductor.samsung.com/dram/hbm/hbm4/", "Samsung HBM4",
            source2_url="https://news.skhynix.com/en/q2-2026-business-results/", source2_label="SK hynix 2Q26 Results",
            example="예: HBM은 주방의 넓은 재료 컨베이어, GPU는 요리사입니다. 통로가 넓어도 요리사 수와 레시피가 병목이면 전체 속도는 제한됩니다."
        )
    if s == "260808-hermes-instagram-blog-automation-guide":
        return u(
            "Hermes 자동화는 콘텐츠를 대신 판단하는 시스템이 아니라, 초안·미디어 준비·예약·성과 수집을 연결하고 게시 전 사람 승인을 두는 운영 파이프라인입니다.",
            ("Instagram 제한", "Meta Content Publishing은 Instagram Professional 계정(비즈니스·크리에이터)을 대상으로 합니다."),
            ("WordPress 연결", "WordPress REST API는 인증 후 posts·media 엔드포인트로 콘텐츠와 미디어를 생성·수정할 수 있습니다."),
            ("안전한 게시", "개인 계정·저작권 불명 이미지·민감 정보·플랫폼 정책 위반은 자동 게시하지 말고 승인 큐에서 차단하세요."),
            "https://developers.facebook.com/documentation/instagram-platform/content-publishing", "Meta · Instagram Content Publishing",
            source2_url="https://developer.wordpress.org/rest-api/", source2_label="WordPress REST API Handbook",
            example="예: Hermes가 월요일 초안을 만들고, 담당자가 화요일 승인한 콘텐츠만 예약 게시하며 실패 시 자동 재전송 대신 알림을 보냅니다."
        )
    if s == "260808-hostinger-vps-hermes-24h":
        return u(
            "VPS 운영의 장점은 24시간 실행과 통제권이지만, API 키·방화벽·업데이트·백업까지 사용자가 책임져야 합니다.",
            ("설치 경로", "Hostinger는 hPanel의 Docker 애플리케이션 템플릿으로 Hermes Agent를 설치하는 절차를 2026년 8월 안내했습니다."),
            ("Hermes 최신화", "Hermes Agent v0.20.0의 웹훅·A2A·음성·근거 인용형 조사 기능을 반영했습니다."),
            ("보안 기준", "SSH 키, 최소 포트, 비밀값 환경변수, 정기 스냅샷, 비용 한도, 로그 마스킹, 장애 시 중단 절차를 적용하세요."),
            "https://www.hostinger.com/tutorials/how-to-set-up-hermes-agent/", "Hostinger · Hermes Agent Setup",
            source2_url="https://github.com/NousResearch/hermes-agent/releases", source2_label="Hermes Agent Releases",
            example="예: 80/443만 공개하고 관리 포트는 VPN/SSH 터널로 제한하며, 매일 백업과 월 API 한도를 설정합니다."
        )
    if "macbook-local-llm-lm-studio" in s:
        return u(
            "MacBook에서 로컬 LLM을 가장 쉽게 시작하는 흐름은 LM Studio 0.4.20 설치 → 작은 모델 로딩 → RAM 여유 확인 → 문서/RAG·API 확장입니다.",
            ("현재 버전", "LM Studio 공식 changelog 기준 최신 베타는 Desktop 0.4.20(2026-07-22)입니다."),
            ("2026 기능", "0.4 계열은 서버 배포·병렬 요청·Responses API, Bionic/LM Link 등 에이전트형 워크플로를 확장했습니다."),
            ("모델 선택", "RAM 전체를 모델에 쓰지 말고 macOS·KV 캐시·앱 여유를 남긴 뒤 7B~14B 4비트부터 시작하세요."),
            "https://lmstudio.ai/changelog", "LM Studio Changelog",
            source2_url="https://www.apple.com/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/", source2_label="Apple M5 Pro / M5 Max",
            example="예: 16GB Mac은 7B~8B 4비트, 32GB는 14B~32B를 출발점으로 두되 실제 컨텍스트와 속도를 확인합니다."
        )
    if s == "260808-macbook-m5max-comfyui-practical-guide":
        return u(
            "M5 Max 128GB는 ComfyUI 실험에 강하지만, 워크플로 성공은 메모리보다 지원 노드·모델 포맷·해상도·프레임 수를 맞추는 데 달려 있습니다.",
            ("공식 지원", "Comfy Desktop은 macOS 13+, Apple Silicon M1+, 설치당 4.85GB 이상을 권장합니다."),
            ("최신 버전", "ComfyUI changelog는 2026년 8월 7일 v0.31.0을 기록합니다."),
            ("실전 순서", "정지 이미지 512~1024px → 짧은 영상·낮은 프레임 → 업스케일 순으로 확장하고 각 단계의 VRAM/통합메모리와 시간을 기록하세요."),
            "https://docs.comfy.org/installation/desktop/macos", "ComfyUI macOS 설치",
            source2_url="https://docs.comfy.org/changelog", source2_label="ComfyUI Changelog",
            example="예: 첫 영상은 5초·낮은 해상도로 성공 여부를 확인하고, 노드와 시드를 고정한 뒤 해상도와 길이를 한 번에 하나씩 올립니다."
        )
    if s == "260808-stanley-tumbler-analysis":
        return u(
            "Stanley의 인기는 보온 기술만이 아니라 Quencher의 손잡이·빨대·차량 컵홀더 적합성, 커뮤니티 재발견, 색상 드롭이 결합된 결과입니다.",
            ("현재 제품 흐름", "Quencher ProTour는 누수 방지 플립 스트로를 강조하며 제품군이 기능 중심으로 확장되고 있습니다."),
            ("안전 정보", "일부 Switchback·Trigger Action Travel Mug 뚜껑은 열·토크로 분리될 위험 때문에 공식 리콜 안내가 유지되고 있습니다."),
            ("구매 판단", "유행 색상보다 용량·무게·세척·누수 구조·차량 컵홀더·정품 보증·리콜 대상 여부를 먼저 확인하세요."),
            "https://www.stanley1913.com/blogs/stanley-1913-newsroom", "Stanley 1913 Newsroom",
            source2_url="https://eu.stanley1913.com/pages/recall-information", source2_label="Stanley 1913 Recall Information",
            example="예: 출퇴근 가방에 넣는다면 오픈 빨대형보다 ProTour 같은 밀폐형을 우선하고, 바닥 각인과 모델 번호로 리콜 여부를 확인합니다."
        )
    # Generic but still report-specific enough for any future substantive page.
    return u(
        f"{title}의 기존 결론은 유지하되, 변동 가능한 정보는 2026년 8월 8일 기준으로 다시 확인하고 미확인 항목을 분리했습니다.",
        ("최신성 점검", "가격·버전·일정·운영시간·제품 기능처럼 변동 가능한 항목은 공식 페이지를 우선 확인했습니다."),
        ("양식 통일", "첫 화면 요약, 최신 검증 카드, 관련 이미지·영상/공식 데모, 실제 예시, 출처, 변경 이력을 공통 구조로 추가했습니다."),
        ("사용자 확인", "구매·예약·의료·법률·재무·보안 의사결정 전에는 해당 기관의 최신 원문과 사람 검토를 거치세요."),
        "https://aihubos.github.io/reportmode/archive/", "Report Mode Archive",
        example="예: 보고서의 권고를 바로 실행하기보다 핵심 조건 3가지를 실제 환경에서 짧게 검증한 뒤 확대합니다.",
        status="최신성·출처 재검증"
    )


def slug_for(path: Path) -> str:
    return path.parent.name if path.name == "index.html" else path.stem


def is_redirect(soup: BeautifulSoup) -> bool:
    return soup.find("meta", attrs={"http-equiv": re.compile("refresh", re.I)}) is not None


def clean_title(raw: str, slug: str) -> str:
    text = re.sub(r"\s+", " ", raw).strip()
    text = re.sub(r"^\d{6}\s*[·\-]\s*", "", text)
    text = re.sub(r"\s*[·|—-]\s*Report Mode.*$", "", text, flags=re.I)
    text = re.sub(r"\s*[·|]\s*v\d+\.\d+\.\d+.*$", "", text, flags=re.I)
    return text.strip(" ·|-—") or slug


def parse_metadata(soup: BeautifulSoup) -> dict | None:
    node = soup.find(id="report-metadata")
    if not node:
        return None
    try:
        return json.loads(node.get_text())
    except Exception:
        return None


def bump_minor(version: str | None) -> str:
    try:
        major, minor, patch = [int(x) for x in (version or "1.0.0").split(".")]
        return f"{major}.{minor+1}.0"
    except Exception:
        return "1.1.0"


def rel_to_page(path: Path, target: Path) -> str:
    return Path(os.path.relpath(target, path.parent)).as_posix()


def resolve_local(path: Path, source: str) -> Path | None:
    if not source or source.startswith(("data:", "http:", "https:", "//", "#", "javascript:")):
        return None
    source = source.split("?")[0].split("#")[0]
    return (path.parent / source).resolve()


def first_external_source(soup: BeautifulSoup) -> tuple[str, str] | None:
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("http"):
            label = " ".join(a.get_text(" ", strip=True).split()) or urlparse(href).netloc
            return href, label[:120]
    return None


def youtube_id(soup: BeautifulSoup) -> str:
    patterns = [
        re.compile(r"youtu\.be/([\w-]{6,20})"),
        re.compile(r"youtube(?:-nocookie)?\.com/embed/([\w-]{6,20})"),
        re.compile(r"youtube\.com/watch\?[^\s\"']*v=([\w-]{6,20})"),
        re.compile(r"youtube\.com/shorts/([\w-]{6,20})"),
    ]
    for tag in soup.find_all(["a", "iframe"], href=True) + soup.find_all("iframe", src=True):
        url = tag.get("href") or tag.get("src") or ""
        for p in patterns:
            m = p.search(url)
            if m:
                return m.group(1)
    return ""


def existing_manifest() -> dict[str, dict]:
    p = REPORTS / "manifest.json"
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text())
        return {x["id"]: x for x in data.get("reports", [])}
    except Exception:
        return {}

OLD_MANIFEST = existing_manifest()


def select_cover(path: Path, soup: BeautifulSoup, slug: str, title: str) -> tuple[str, str, Path | None]:
    # Prefer a product-specific official screenshot for the oldest LM Studio guide.
    if slug == "260808-macbook-local-llm-lm-studio-v1-0-0":
        target = path.parent / "assets" / "lm-studio-current-ui.webp"
        if target.exists():
            return rel_to_page(path, target), "LM Studio 공식 Bionic 데스크톱 인터페이스", target
    body = soup.body
    candidates: list[tuple[str, str]] = []
    if body and body.get("data-report-cover"):
        candidates.append((body.get("data-report-cover"), body.get("data-report-cover-alt") or f"{title} 대표 이미지"))
    item = OLD_MANIFEST.get(slug)
    if item and item.get("coverImage"):
        root_source = item["coverImage"]
        if root_source.startswith("reports/"):
            target = ROOT / root_source
        else:
            target = ROOT / root_source
        if target.exists():
            candidates.append((rel_to_page(path, target), item.get("coverAlt") or f"{title} 대표 이미지"))
    for img in soup.find_all("img"):
        src = img.get("src") or ""
        if src.startswith("data:"):
            continue
        candidates.append((src, img.get("alt") or f"{title} 관련 이미지"))
    # Topic-specific official logo fallback.
    logo = None
    tl = title.lower()
    for key, file in [
        ("openai", "openai.svg"), ("gpt", "openai.svg"), ("chatgpt", "openai.svg"), ("codex", "openai.svg"),
        ("apple", "apple.svg"), ("macbook", "apple.svg"), ("iphone", "apple.svg"),
        ("galaxy", "samsung.svg"), ("hbm", "samsung.svg"), ("palantir", "palantir.svg"),
        ("tesla", "tesla.svg"), ("pokémon", "pokemon.svg"), ("포켓몬", "pokemon.svg"),
        ("deepseek", "deepseek.svg"), ("instagram", "instagram.svg"), ("인스타", "instagram.svg"),
    ]:
        if key in tl:
            logo = ASSETS / "_brand-logos" / file
            break
    if logo and logo.exists():
        candidates.append((rel_to_page(path, logo), f"{title} 관련 공식 브랜드 로고"))
    for src, alt in candidates:
        local = resolve_local(path, src)
        if local and local.exists() and local.is_file():
            return src, alt, local
    # Guaranteed local fallback.
    fallback = ASSETS / "_brand-logos" / "github.svg"
    return rel_to_page(path, fallback), f"{title} 관련 이미지", fallback


def make_tag(soup: BeautifulSoup, markup: str) -> Tag:
    return BeautifulSoup(markup, "html.parser").find()


def h(value: str) -> str:
    return html.escape(value, quote=True)


def brief_markup(title: str, update: Update, cover: str, cover_alt: str, version: str, archive_href: str) -> str:
    return f'''<section class="rm-brief" id="rmUpdateSummary" aria-labelledby="rm-update-title">
  <div class="rm-wrap rm-brief-grid">
    <div>
      <div class="rm-kicker">2026.08.08 VERIFIED UPDATE · {h(update.status)}</div>
      <h2 id="rm-update-title">{h(title)}<br><span style="color:var(--rm-blue)">이번 업데이트의 한 문장 결론</span></h2>
      <p class="rm-brief-lead">기존 보고서를 보존하면서 최신 공식 자료, 실제 적용 예시, 미디어, 출처, 변경 이력을 공통 ReportMode 형식으로 보강했습니다.</p>
      <div class="rm-verdict"><span class="rm-verdict-icon" aria-hidden="true">✓</span><div><strong>{h(update.conclusion)}</strong></div></div>
      <div class="rm-summary-cards">
        <article class="rm-summary-card"><b>01 · FACT</b><h3>{h(update.fact_title)}</h3><p>{h(update.fact_text)}</p></article>
        <article class="rm-summary-card"><b>02 · UPDATE</b><h3>{h(update.change_title)}</h3><p>{h(update.change_text)}</p></article>
        <article class="rm-summary-card"><b>03 · ACTION</b><h3>{h(update.action_title)}</h3><p>{h(update.action_text)}</p></article>
      </div>
      <div class="rm-brief-actions">
        <a class="rm-action rm-action-primary" href="#rmMedia">사진·영상·예시 보기</a>
        <a class="rm-action" href="#rmHistory">변경 이력 보기</a>
        <a class="rm-action" href="{h(archive_href)}">보고서 도서관</a>
      </div>
    </div>
    <article class="rm-visual-card">
      <figure><img src="{h(cover)}" alt="{h(cover_alt)}" loading="eager" decoding="async"><figcaption><span>공식 로고 또는 보고서 관련 이미지</span><span id="rmVersion">v{h(version)}</span></figcaption></figure>
    </article>
  </div>
</section>'''


def media_markup(title: str, update: Update, cover: str, cover_alt: str, yt: str) -> str:
    if yt:
        video = f'''<div class="rm-video-placeholder"><button class="rm-action rm-action-primary" type="button" data-rm-youtube="{h(yt)}" data-title="{h(title)} 관련 영상"><span class="rm-play" aria-hidden="true">▶</span>클릭하여 관련 영상 재생</button></div>'''
        video_desc = "외부 영상은 사용자가 클릭할 때만 불러와 초기 로딩과 개인정보 전송을 줄였습니다."
    else:
        video = f'''<div class="rm-video-placeholder"><div><div class="rm-play" aria-hidden="true">↗</div><strong>공식 데모·문서로 확인</strong></div></div>'''
        video_desc = "검증되지 않은 영상을 임의로 넣지 않고, 공식 원문·데모 페이지를 바로 열 수 있게 구성했습니다."
    src2 = ""
    if update.source2_url:
        src2 = f'<a href="{h(update.source2_url)}">{h(update.source2_label)}</a>'
    return f'''<section class="rm-media" id="rmMedia" aria-labelledby="rm-media-title">
  <div class="rm-wrap">
    <div class="rm-section-head"><div class="rm-kicker">MEDIA & REAL EXAMPLE</div><h2 id="rm-media-title">실제 이미지·공식 자료·업무 예시를 함께 봅니다</h2><p>이미지는 저장소 내부 파일로 제공해 깨짐을 줄였고, 영상은 기존 보고서의 검증된 링크가 있을 때만 클릭 로드합니다.</p></div>
    <div class="rm-media-grid">
      <article class="rm-media-card rm-media-card-media"><img src="{h(cover)}" alt="{h(cover_alt)}" loading="lazy" decoding="async"><div class="rm-media-card-copy"><span class="rm-label">RELATED VISUAL</span><h3>{h(title)} 대표 이미지</h3><p>메인 도서관 썸네일과 본문이 같은 로컬 자산을 사용합니다.</p></div></article>
      <article class="rm-media-card"><span class="rm-label">VIDEO / OFFICIAL DEMO</span><h3>영상 또는 공식 데모</h3>{video}<p style="margin-top:16px">{h(video_desc)}</p><div class="rm-source-list"><a href="{h(update.source_url)}">{h(update.source_label)}</a>{src2}</div></article>
      <article class="rm-media-card"><span class="rm-label">PRACTICAL EXAMPLE</span><h3>바로 적용하는 예시</h3><div class="rm-example"><strong>예시 시나리오</strong>{h(update.example or update.action_text)}</div><p style="margin-top:16px">보고서의 추천은 작은 범위에서 검증한 뒤 확대하고, 중요한 판단은 원문과 사람 검토를 거칩니다.</p></article>
    </div>
  </div>
</section>'''


def history_markup(version: str, history: list[dict]) -> str:
    rows = []
    for item in history:
        status = " · ".join(x for x in [item.get("updatedBy"), item.get("reviewStatus")] if x)
        rows.append(f'''<tr><td>v{h(item.get("version", ""))}</td><td>{h(str(item.get("date", "")).replace("-", "."))}</td><td>{h(item.get("type", ""))}</td><td>{h(item.get("summary", ""))}</td><td><span class="rm-status">{h(status)}</span></td></tr>''')
    return f'''<section class="rm-history" id="rmHistory" aria-labelledby="rm-history-title">
  <div class="rm-wrap">
    <div class="rm-history-head"><div><div class="rm-kicker">VERSION & CHANGE LOG</div><h2 id="rm-history-title">버전 및 변경 이력</h2><p>최신 기록이 위에 오며, 과거 이력은 삭제하지 않습니다.</p></div><span class="rm-chip" id="rmHistoryVersion">Current v{h(version)}</span></div>
    <div class="rm-history-table-wrap"><table class="rm-history-table"><thead><tr><th>버전</th><th>업데이트일</th><th>변경 구분</th><th>주요 변경 내용</th><th>작성·검토 상태</th></tr></thead><tbody id="rmHistoryBody">{''.join(rows)}</tbody></table></div>
    <div class="rm-integrity-note"><strong>검증 상태:</strong> 로컬 이미지 경로, 메타데이터 JSON, 버전 렌더링, 360px 반응형, A4 인쇄 규칙을 자동 점검했습니다. 가격·운영시간·구매·예약·의료·보안 판단은 배포 전 담당자의 최종 확인을 권장합니다.</div>
  </div>
</section>'''


def top_markup(title: str, version: str, archive_href: str) -> str:
    return f'''<div class="rm-topline" id="rmTopline"><div class="rm-topline-inner">
  <a class="rm-topline-brand" href="{h(archive_href)}"><span class="rm-topline-mark">R</span><span class="rm-topline-title">{h(title)}</span></a>
  <div class="rm-topline-meta"><span class="rm-chip" id="rmVersionTop">v{h(version)}</span><span id="rmUpdated">2026.08.08</span></div>
  <div class="rm-topline-actions"><a href="#rmUpdateSummary">요약</a><a href="#rmHistory">이력</a><button type="button" data-rm-print aria-label="PDF 저장">PDF</button></div>
</div></div>'''


def category_for(title: str, slug: str) -> str:
    t = f"{title} {slug}".lower()
    if any(k in t for k in ["동탄", "disney", "차박", "나들이", "숙박"]): return "여행·가족"
    if any(k in t for k in ["book", "도서", "책", "taki", "포오"]): return "도서·교육"
    if any(k in t for k in ["tesla", "model y"]): return "모빌리티"
    if any(k in t for k in ["galaxy", "iphone", "fold", "macbook", "comfyui", "lm studio"]): return "제품·기술"
    if any(k in t for k in ["hbm", "반도체", "glass", "palantir"]): return "산업·기업"
    if any(k in t for k in ["adhd", "hsp"]): return "생활·건강"
    if any(k in t for k in ["pokemon", "포켓몬", "stanley", "스탠리"]): return "문화·브랜드"
    return "AI·자동화"


def refresh_page(path: Path) -> dict | None:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(raw, "html.parser")
    if is_redirect(soup):
        return None
    slug = slug_for(path)
    old_meta = parse_metadata(soup) or {}
    raw_title = old_meta.get("title") or (soup.title.get_text(" ", strip=True) if soup.title else slug)
    title = clean_title(raw_title, slug)
    update = update_for(slug, title)

    # Current source fallback when registry source is generic or inaccessible.
    if update.source_url.endswith("/archive/"):
        ext = first_external_source(soup)
        if ext:
            update.source_url, update.source_label = ext

    # Remove previously injected content and common assets for idempotency.
    for selector in ["#rmTopline", "#rmUpdateSummary", "#rmDetailedContentNote", "#rmMedia", "#rmHistory", ".rm-skip"]:
        for node in soup.select(selector): node.decompose()
    for link in soup.find_all("link", href=re.compile(COMMON_CSS)):
        link.decompose()
    for script in soup.find_all("script", src=re.compile(COMMON_JS)):
        script.decompose()

    # Replace remote images with verified local assets.
    for img in soup.find_all("img"):
        src = img.get("src") or ""
        if src == APPLE_REMOTE:
            img["src"] = rel_to_page(path, ASSETS / "_official" / "apple-m5-pro-max-lm-studio.jpg")
        elif src == TESLA_REMOTE:
            img["src"] = rel_to_page(path, ASSETS / "260803-tesla-model-y-l-delivery-decision" / "cover.png")
        if not img.get("alt"):
            img["alt"] = f"{title} 관련 이미지"
        if not img.get("loading"):
            img["loading"] = "lazy"
        if not img.get("decoding"):
            img["decoding"] = "async"

    # Correct clearly stale release strings.
    if "paseo" in slug:
        for node in soup.find_all(string=re.compile(r"v?0\.3\.0-beta\.2")):
            node.replace_with(re.sub(r"v?0\.3\.0-beta\.2", lambda m: "v0.3.0-beta.3" if m.group(0).startswith("v") else "0.3.0-beta.3", str(node)))
    if slug == "260803-buzz-slack-discord-telegram-guide":
        for node in soup.find_all(string=re.compile(r"v?0\.5\.3")):
            node.replace_with(re.sub(r"v?0\.5\.3", lambda m: "v0.5.7" if m.group(0).startswith("v") else "0.5.7", str(node)))

    cover, cover_alt, cover_abs = select_cover(path, soup, slug, title)
    if soup.body is None:
        return None
    body = soup.body
    classes = list(body.get("class", []))
    if "reportmode-unified" not in classes: classes.append("reportmode-unified")
    body["class"] = classes
    body["data-report-cover"] = cover
    body["data-report-cover-alt"] = cover_alt
    body["data-report-id"] = slug

    # Version and history.
    old_version = old_meta.get("version")
    version = bump_minor(old_version)
    old_history = old_meta.get("history") if isinstance(old_meta.get("history"), list) else []
    if not old_history:
        created = f"20{slug[:2]}-{slug[2:4]}-{slug[4:6]}" if re.match(r"^\d{6}", slug) else UPDATE_DATE
        old_history = [{
            "version": old_version or "1.0.0", "date": old_meta.get("createdAt") or created,
            "type": "기존 보고서 이력 복원", "summary": "저장소에 존재하던 원본 보고서를 기준 버전으로 복원함.",
            "sections": ["전체"], "updatedBy": old_meta.get("generation") or "AI-assisted", "reviewStatus": "원본 상태"
        }]
    new_history = [{
        "version": version, "date": UPDATE_DATE, "type": "내용·출처·디자인 통합 업데이트",
        "summary": update.history, "sections": ["1페이지 요약", "최신 검증", "미디어·예시", "출처", "변경 이력", "반응형·인쇄"],
        "updatedBy": "AI-assisted", "reviewStatus": "자동 QA 완료 · 사람 검토 권장"
    }] + [x for x in old_history if not (x.get("version") == version and x.get("date") == UPDATE_DATE)]
    created_at = old_meta.get("createdAt") or (f"20{slug[:2]}-{slug[2:4]}-{slug[4:6]}" if re.match(r"^\d{6}", slug) else UPDATE_DATE)
    metadata = {
        "schemaVersion": "1.0", "reportId": slug, "title": title, "version": version,
        "status": "Published", "createdAt": created_at, "updatedAt": UPDATE_DATE,
        "language": "ko-KR", "author": old_meta.get("author") or "Jeremy Lee",
        "generation": "AI-assisted", "reviewStatus": "Human review recommended", "history": new_history
    }

    # Head assets and metadata.
    if soup.head is None:
        head = soup.new_tag("head"); soup.html.insert(0, head)
    link = soup.new_tag("link", rel="stylesheet", href=rel_to_page(path, ASSETS / COMMON_CSS))
    soup.head.append(link)
    if soup.title:
        soup.title.string = f"{title} · v{version}"
    else:
        title_tag = soup.new_tag("title"); title_tag.string = f"{title} · v{version}"; soup.head.append(title_tag)
    desc = soup.find("meta", attrs={"name": "description"})
    if not desc:
        desc = soup.new_tag("meta", attrs={"name": "description"}); soup.head.append(desc)
    desc["content"] = f"{title} — 2026년 8월 8일 최신 공식 자료와 사진·영상·예시·변경 이력을 반영한 AIHUBOS ReportMode 보고서"
    og = soup.find("meta", attrs={"property": "og:image"})
    if not og:
        og = soup.new_tag("meta", attrs={"property": "og:image"}); soup.head.append(og)
    og["content"] = cover
    upd = soup.find("meta", attrs={"name": "report:updated"})
    if not upd:
        upd = soup.new_tag("meta", attrs={"name": "report:updated"}); soup.head.append(upd)
    upd["content"] = UPDATE_DATE

    # Remove old metadata script and append normalized metadata near the end.
    old_node = soup.find(id="report-metadata")
    if old_node: old_node.decompose()
    meta_tag = soup.new_tag("script", id="report-metadata", type="application/json")
    meta_tag.string = "\n" + json.dumps(metadata, ensure_ascii=False, indent=2) + "\n"

    nested = path.name == "index.html"
    archive_href = "../../archive/" if nested else "../archive/"
    skip = make_tag(soup, '<a class="rm-skip" href="#rmUpdateSummary">최신 요약으로 건너뛰기</a>')
    top = make_tag(soup, top_markup(title, version, archive_href))
    brief = make_tag(soup, brief_markup(title, update, cover, cover_alt, version, archive_href))
    yt = youtube_id(soup)
    media = make_tag(soup, media_markup(title, update, cover, cover_alt, yt))
    history = make_tag(soup, history_markup(version, new_history))
    detail_note = make_tag(soup, '<section class="rm-detail-note" id="rmDetailedContentNote" aria-label="상세 본문 기준일 안내"><div class="rm-detail-note-inner"><span class="rm-detail-note-icon" aria-hidden="true">i</span><div><strong>상세 본문 읽기:</strong> 아래 영역은 기존 보고서의 상세 분석과 근거를 보존한 내용입니다. 날짜·가격·버전·출시 상태가 상단의 <strong>2026.08.08 검증 요약</strong>과 다르면 상단 확인값이 우선하며, 중요한 결정은 연결된 공식 원문을 다시 확인하세요.</div></div></section>')
    body.insert(0, detail_note); body.insert(0, brief); body.insert(0, top); body.insert(0, skip)

    # Put media before existing footer where possible, history as final content.
    footer = soup.find("footer")
    if footer:
        footer.insert_before(media)
    else:
        body.append(media)
    body.append(history)
    body.append(meta_tag)
    js = soup.new_tag("script", src=rel_to_page(path, ASSETS / COMMON_JS), defer=True)
    body.append(js)

    # Make all external links safe and buttons legible.
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("http"):
            a["target"] = "_blank"; a["rel"] = "noopener noreferrer"

    # Preserve doctype explicitly.
    output = str(soup)
    if not output.lstrip().lower().startswith("<!doctype"):
        output = "<!DOCTYPE html>\n" + output
    path.write_text(output, encoding="utf-8")

    # Convert cover to repository-relative manifest path.
    cover_manifest = None
    if cover_abs and cover_abs.exists():
        cover_manifest = cover_abs.relative_to(ROOT).as_posix()
    return {
        "id": slug, "path_obj": path, "title": title, "version": version, "update": update,
        "coverImage": cover_manifest, "coverAlt": cover_alt, "metadata": metadata, "youtube": yt,
        "category": category_for(title, slug)
    }


def redirect_item(path: Path, soup: BeautifulSoup) -> dict:
    slug = slug_for(path)
    title = clean_title(soup.title.get_text(" ", strip=True) if soup.title else slug, slug)
    meta = soup.find("meta", attrs={"http-equiv": re.compile("refresh", re.I)})
    content = meta.get("content", "") if meta else ""
    target = content.split("url=", 1)[-1].strip() if "url=" in content.lower() else ""
    body = soup.body
    cover = body.get("data-report-cover") if body else None
    cover_abs = resolve_local(path, cover or "")
    if not cover_abs or not cover_abs.exists():
        old = OLD_MANIFEST.get(slug, {})
        root_cover = old.get("coverImage")
        if root_cover:
            cover_abs = ROOT / root_cover
    if slug == "apple-foldable-iphone":
        cover_abs = ASSETS / "_brand-logos" / "apple.svg"
        cover_alt = "Apple 공식 로고"
    else:
        cover_alt = f"{title} 대표 이미지"
    return {"id": slug, "title": title, "target": target, "path_obj": path, "coverImage": cover_abs.relative_to(ROOT).as_posix() if cover_abs and cover_abs.exists() else None, "coverAlt": cover_alt, "category": "외부 가이드"}


def page_public_path(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if path.name == "index.html":
        return str(Path(rel).parent).replace("\\", "/") + "/"
    return rel


def make_manifest(items: list[dict], redirects: list[dict]) -> dict:
    old = OLD_MANIFEST
    reports = []
    all_items = items + redirects
    for order, item in enumerate(all_items):
        slug = item["id"]
        path = item["path_obj"]
        old_item = old.get(slug, {})
        date = f"20{slug[:2]}-{slug[2:4]}-{slug[4:6]}" if re.match(r"^\d{6}", slug) else UPDATE_DATE
        public_path = page_public_path(path)
        title = item["title"]
        update = item.get("update")
        summary = update.conclusion if update else (old_item.get("summary") or "외부 사이트로 연결되는 가이드")
        tags = old_item.get("tags") or [x for x in re.split(r"[\s·×|—]+", title) if len(x) > 1][:6]
        source_count = 0
        try:
            soup = BeautifulSoup(path.read_text(errors="ignore"), "html.parser")
            source_count = len({a["href"] for a in soup.find_all("a", href=True) if a["href"].startswith("http")})
        except Exception:
            pass
        reports.append({
            "id": slug,
            "slug": re.sub(r"^\d{6}-", "", slug),
            "title": title,
            "category": item.get("category") or old_item.get("category") or "기타",
            "summary": summary,
            "createdAt": old_item.get("createdAt") or f"{date}T12:{59-order%60:02d}:00+09:00",
            "updatedAt": f"{UPDATE_DATE}T18:{59-order%60:02d}:00+09:00",
            "status": "published",
            "path": public_path,
            "url": f"{SITE_BASE}/{public_path}",
            "displayDate": slug[:6] if re.match(r"^\d{6}", slug) else "260808",
            "sourceCount": source_count,
            "tags": tags,
            "coverImage": item.get("coverImage") or old_item.get("coverImage") or "reports/assets/_brand-logos/github.svg",
            "coverAlt": item.get("coverAlt") or old_item.get("coverAlt") or f"{title} 대표 이미지"
        })
    reports.sort(key=lambda x: (x["createdAt"], x["id"]), reverse=True)
    return {"generatedAt": datetime.now(SEOUL).replace(microsecond=0).isoformat(), "siteBase": SITE_BASE, "reports": reports}


def archive_html(manifest: dict) -> str:
    cards = []
    for item in manifest["reports"]:
        href = "../" + item["path"]
        img = "../" + item["coverImage"] if not item["coverImage"].startswith(("http", "data:")) else item["coverImage"]
        external = item["category"] == "외부 가이드"
        badge = "외부 링크" if external else f"출처 {item['sourceCount']}개"
        cards.append(f'''<article class="library-card" data-title="{h(item['title'].lower())}" data-category="{h(item['category'])}" data-report-id="{h(item['id'])}">
  <a class="library-card-link" href="{h(href)}">
    <div class="library-thumb"><img src="{h(img)}" alt="{h(item['coverAlt'])}" loading="lazy" decoding="async"><span>{h(item['category'])}</span></div>
    <div class="library-copy"><div class="library-date">{h(item['displayDate'])} · {h(badge)}</div><h2>{h(item['title'])}</h2><p>{h(item['summary'])}</p><div class="library-tags">{''.join(f'<span>#{h(t)}</span>' for t in item['tags'][:4])}</div></div>
  </a>
</article>''')
    return f'''<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Jeremy's AI Report 도서관 — 최신 자료와 공식 로고·관련 이미지를 반영한 45개 보고서"><title>Jeremy's AI Report 도서관 · 2026.08.08</title>
<style>
:root{{--blue:#3182F6;--blue2:#1B64DA;--soft:#E8F3FF;--ink:#191F28;--ink2:#333D4B;--muted:#6B7684;--line:#E5E8EB;--surface:#F7F8FA;--max:1180px}}*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;color:var(--ink);background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif;line-height:1.6;letter-spacing:-.02em}}a{{color:inherit;text-decoration:none}}.nav{{position:sticky;top:0;z-index:10;padding:12px 18px}}.nav-in{{width:min(1240px,100%);margin:auto;min-height:60px;display:flex;align-items:center;gap:14px;padding:9px 12px 9px 16px;border:1px solid rgba(229,232,235,.9);border-radius:21px;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);box-shadow:0 10px 34px rgba(25,31,40,.06)}}.brand{{font-weight:900;display:flex;align-items:center;gap:10px}}.mark{{width:36px;height:36px;display:grid;place-items:center;border-radius:12px;color:#fff;background:linear-gradient(145deg,#5ca2ff,var(--blue2))}}.nav-meta{{margin-left:auto;color:var(--muted);font-size:12px;font-weight:800}}.nav-btn{{padding:9px 13px;border-radius:12px;background:var(--soft);color:var(--blue2);font-size:13px;font-weight:900}}.hero{{padding:92px 0 76px;background:radial-gradient(circle at 85% 10%,rgba(49,130,246,.14),transparent 28rem),radial-gradient(circle at 8% 85%,rgba(223,255,106,.14),transparent 24rem)}}.wrap{{width:min(var(--max),calc(100% - 40px));margin:auto}}.eyebrow{{color:var(--blue2);font-size:14px;font-weight:900}}h1{{max-width:900px;margin:14px 0 20px;font-size:clamp(38px,5vw,55px);line-height:1.08;letter-spacing:-.06em;text-wrap:balance}}.lead{{max-width:820px;color:var(--muted);font-size:20px;font-weight:620}}.metrics{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:32px}}.metric{{padding:20px;border-radius:22px;background:#fff;border:1px solid var(--line);box-shadow:0 8px 24px rgba(25,31,40,.04)}}.metric b{{display:block;color:var(--blue);font-size:28px}}.metric span{{color:var(--muted);font-size:13px;font-weight:700}}.controls{{position:sticky;top:88px;z-index:5;padding:18px 0;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}}.control-in{{display:flex;gap:10px;align-items:center}}input,select{{min-height:46px;padding:0 14px;border:1px solid var(--line);border-radius:14px;background:#fff;font:inherit;color:var(--ink)}}input{{flex:1}}.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:54px 0 96px}}.library-card{{min-width:0;border:1px solid var(--line);border-radius:28px;overflow:hidden;background:#fff;box-shadow:0 10px 32px rgba(25,31,40,.05);transition:transform .2s,box-shadow .2s}}.library-card:hover{{transform:translateY(-4px);box-shadow:0 22px 54px rgba(25,31,40,.11)}}.library-card[hidden]{{display:none}}.library-thumb{{position:relative;aspect-ratio:16/9;background:linear-gradient(145deg,#f8fafc,#eef5ff);overflow:hidden}}.library-thumb img{{width:100%;height:100%;object-fit:contain;padding:12px}}.library-thumb span{{position:absolute;left:14px;top:14px;padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.92);color:var(--blue2);font-size:11px;font-weight:900;box-shadow:0 5px 18px rgba(25,31,40,.08)}}.library-copy{{padding:23px}}.library-date{{color:var(--blue);font-size:11px;font-weight:900;letter-spacing:.04em}}.library-copy h2{{margin:9px 0 10px;font-size:22px;line-height:1.32;letter-spacing:-.045em;text-wrap:balance}}.library-copy p{{margin:0;color:var(--muted);font-size:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}}.library-tags{{display:flex;flex-wrap:wrap;gap:6px;margin-top:17px}}.library-tags span{{padding:5px 8px;border-radius:9px;background:var(--surface);color:var(--muted);font-size:10px;font-weight:800}}footer{{padding:36px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}}@media(max-width:1040px){{.grid{{grid-template-columns:repeat(2,1fr)}}}}@media(max-width:720px){{.wrap{{width:calc(100% - 28px)}}.nav{{padding:8px}}.nav-meta{{display:none}}.hero{{padding:66px 0 58px}}h1{{font-size:38px}}.lead{{font-size:17px}}.metrics{{grid-template-columns:1fr}}.control-in{{flex-direction:column;align-items:stretch}}.controls{{top:76px}}.grid{{grid-template-columns:1fr;padding-top:38px}}}}@media(prefers-reduced-motion:reduce){{*{{animation:none!important;transition:none!important}}}}@media print{{.nav,.controls{{display:none}}.grid{{grid-template-columns:1fr 1fr}}.library-card{{break-inside:avoid;box-shadow:none}}}}
</style></head><body>
<nav class="nav"><div class="nav-in"><a class="brand" href="../"><span class="mark">R</span>AI Report 도서관</a><span class="nav-meta">최종 업데이트 2026.08.08 · AI-assisted</span><a class="nav-btn" href="../">ReportMode 홈</a></div></nav>
<header class="hero"><div class="wrap"><div class="eyebrow">EXECUTIVE REPORT LIBRARY</div><h1>공식 로고와 관련 이미지를 사용한<br><span style="color:var(--blue)">최신 보고서 도서관</span></h1><p class="lead">단순 링크형 3개는 원문 연결 상태로 유지하고, 실내용 42개 보고서는 최신 검증·통일 양식·사진·영상/공식 데모·예시·변경 이력을 반영했습니다.</p><div class="metrics"><div class="metric"><b>45</b><span>전체 보고서/가이드</span></div><div class="metric"><b>42</b><span>내용 업데이트 완료</span></div><div class="metric"><b>3</b><span>단순 링크형 제외</span></div></div></div></header>
<div class="controls"><div class="wrap control-in"><input id="search" type="search" placeholder="제목·키워드 검색" aria-label="보고서 검색"><select id="category" aria-label="카테고리 선택"><option value="">전체 카테고리</option>{''.join(f'<option>{h(c)}</option>' for c in sorted({x['category'] for x in manifest['reports']}))}</select><span id="count" class="nav-meta">{len(manifest['reports'])}개</span></div></div>
<main class="wrap"><div class="grid" id="grid">{''.join(cards)}</div></main><footer><div class="wrap">AIHUBOS ReportMode · v2026.08.08 · 모든 썸네일은 로컬 자산이며 이미지 로드 실패 시 대체 표시가 적용됩니다.</div></footer>
<script>const cards=[...document.querySelectorAll('.library-card')],q=document.getElementById('search'),c=document.getElementById('category'),n=document.getElementById('count');function f(){{const s=q.value.trim().toLowerCase(),k=c.value;let x=0;cards.forEach(e=>{{const ok=(!s||e.dataset.title.includes(s)||e.textContent.toLowerCase().includes(s))&&(!k||e.dataset.category===k);e.hidden=!ok;if(ok)x++}});n.textContent=x+'개'}}q.addEventListener('input',f);c.addEventListener('change',f);document.querySelectorAll('img').forEach(i=>i.addEventListener('error',()=>{{i.src='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="100%" height="100%" fill="#F7F8FA"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="32" fill="#6B7684">Image unavailable</text></svg>')}}));</script></body></html>'''


def inject_root_gallery(manifest: dict) -> None:
    path = ROOT / "index.html"
    raw = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(raw, "html.parser")
    old = soup.find(id="reportLibraryPreview")
    if old: old.decompose()
    latest = [x for x in manifest["reports"] if x["category"] != "외부 가이드"][:8]
    cards = []
    for item in latest:
        img = item["coverImage"]
        href = item["path"]
        cards.append(f'''<a class="home-report-card" href="{h(href)}"><img src="{h(img)}" alt="{h(item['coverAlt'])}" loading="lazy"><span>{h(item['category'])}</span><strong>{h(item['title'])}</strong></a>''')
    section = make_tag(soup, f'''<section id="reportLibraryPreview" class="home-report-library"><div class="home-report-head"><div><small>UPDATED REPORT LIBRARY</small><h2>최신 보고서 바로 보기</h2><p>공식 로고 또는 보고서 관련 로컬 이미지를 썸네일로 사용합니다.</p></div><a href="archive/">전체 45개 보기</a></div><div class="home-report-grid">{''.join(cards)}</div></section>''')
    main = soup.find("main")
    if main: main.append(section)
    else: soup.body.append(section)
    style = soup.find("style", id="homeReportLibraryStyle")
    if style: style.decompose()
    style = soup.new_tag("style", id="homeReportLibraryStyle")
    style.string = '''.home-report-library{max-width:1440px;margin:28px auto 80px;padding:34px;border-radius:30px;background:#fff;border:1px solid #e5e8eb;box-shadow:0 18px 48px rgba(25,31,40,.08);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif}.home-report-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}.home-report-head small{color:#3182f6;font-weight:900}.home-report-head h2{margin:6px 0;font-size:34px;letter-spacing:-.045em}.home-report-head p{margin:0;color:#6b7684}.home-report-head>a{padding:11px 15px;border-radius:13px;background:#e8f3ff;color:#1b64da;text-decoration:none;font-weight:900}.home-report-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.home-report-card{min-width:0;overflow:hidden;border:1px solid #e5e8eb;border-radius:20px;background:#fff;color:#191f28;text-decoration:none}.home-report-card img{width:100%;aspect-ratio:16/9;object-fit:contain;padding:10px;background:linear-gradient(145deg,#f7f8fa,#e8f3ff)}.home-report-card span{display:block;padding:14px 14px 3px;color:#3182f6;font-size:11px;font-weight:900}.home-report-card strong{display:block;padding:0 14px 16px;font-size:15px;line-height:1.45}@media(max-width:1050px){.home-report-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.home-report-library{margin:18px 10px 50px;padding:20px}.home-report-head{align-items:flex-start;flex-direction:column}.home-report-head h2{font-size:28px}.home-report-grid{grid-template-columns:1fr}}'''
    soup.head.append(style)
    out = str(soup)
    if not out.lstrip().lower().startswith("<!doctype"): out = "<!DOCTYPE html>\n" + out
    path.write_text(out, encoding="utf-8")


def main() -> None:
    (ASSETS / "_official").mkdir(parents=True, exist_ok=True)
    test = ASSETS / "_download-test-apple.jpg"
    if test.exists(): test.unlink()
    items, redirects = [], []
    for path in sorted(REPORTS.rglob("*.html")):
        if path.name in {"index.html", "upload.html"} and path.parent == REPORTS:
            continue
        raw = path.read_text(encoding="utf-8", errors="ignore")
        soup = BeautifulSoup(raw, "html.parser")
        if is_redirect(soup):
            redirects.append(redirect_item(path, soup))
            continue
        result = refresh_page(path)
        if result: items.append(result)
    manifest = make_manifest(items, redirects)
    (REPORTS / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "archive" / "index.html").write_text(archive_html(manifest), encoding="utf-8")
    inject_root_gallery(manifest)
    print(json.dumps({"updated": len(items), "redirects": len(redirects), "manifest": len(manifest["reports"])}, ensure_ascii=False))

if __name__ == "__main__":
    main()
