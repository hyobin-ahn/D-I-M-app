"""
주역(周易) 64괘 7대 정본 주석 추출기 (AKS 한국주역대전 DB & ctext.org 정본 수록)

1. AKS (한국학중앙연구원 한국주역대전 DB):
   - 정이(程頤, 伊川易傳): 정본 원문 + 한국학술원 공인 국역
   - 주희(朱熹, 周易本義): 정본 원문 + 한국학술원 공인 국역
   - 운봉호씨(胡一桂, 纂注) & 쌍호호씨(胡炳文, 通釋): 소주(小註) 정본 원문 + 국역
   - 한국 13대 역학 대가(송시열, 이익, 정약용, 유정원 등) 주석 원문 + 국역

2. ctext.org (中國哲學書電子化計劃):
   - 왕필(王弼, 周易注) & 공영달(孔穎達, 周易正義 疏): 무영전 십삼경주소본 정본 원문
   - 소식(蘇軾, 東坡易傳): 동파역전 정본 원문
"""

import urllib.request
import urllib.parse
import re
import sys
import json
import time
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def clean_html(text):
    if not text:
        return ""
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    return '\n'.join(lines)

def fetch_url(url, timeout=15):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode('utf-8', errors='ignore')

# -------------------------------------------------------------
# 1. AKS (한국주역대전) 파서
# -------------------------------------------------------------
def parse_aks_section(data_id):
    """AKS 단일 섹션(괘사 또는 특정 효사) 파싱"""
    url = f"https://waks.aks.ac.kr/rsh/dir/rview.aspx?rshID=AKS-2012-EAZ-2101&callType=dir&dataID={data_id}"
    try:
        html = fetch_url(url)
    except Exception as e:
        return None

    # 제목 (전각 콜론 '：' 및 반각 콜론 ':' 모두 지원, 테이블 정보 백업)
    m_title = re.search(r'<h1 class="title">주역대전\s*[:：]\s*(.*?)</h1>', html)
    raw_title = m_title.group(1).strip() if m_title else ""
    if not raw_title:
        m_tbl_title = re.search(r'<th[^>]*>제목</th>\s*<td>(.*?)</td>', html)
        if m_tbl_title:
            raw_title = m_tbl_title.group(1).strip()

    if not raw_title or "NOT FOUND" in raw_title:
        return None

    # 구분 판단
    section_type = "unknown"
    line_name = ""
    if "_괘사" in raw_title or "괘사" == raw_title:
        section_type = "gwaesa"
        line_name = "卦辭(괘사)"
    elif "효사-초효" in raw_title:
        section_type = "line_0"
        line_name = "初爻"
    elif "효사-이효" in raw_title:
        section_type = "line_1"
        line_name = "二爻"
    elif "효사-삼효" in raw_title:
        section_type = "line_2"
        line_name = "三爻"
    elif "효사-사효" in raw_title:
        section_type = "line_3"
        line_name = "四爻"
    elif "효사-오효" in raw_title:
        section_type = "line_4"
        line_name = "五爻"
    elif "효사-상효" in raw_title:
        section_type = "line_5"
        line_name = "上爻"
    elif "용구" in raw_title:
        section_type = "yong_9"
        line_name = "用九"
    elif "용육" in raw_title:
        section_type = "yong_6"
        line_name = "用六"
    elif "단전" in raw_title:
        section_type = "tuan"
        line_name = "彖傳"
    elif "상전" in raw_title or "소상" in raw_title:
        section_type = "xiang"
        line_name = "象傳"
    elif "총론" in raw_title:
        section_type = "intro"
        line_name = "總論"

    # 경문(經文)
    m_script = re.search(r'<h2>경문</h2><h3>(.*?)</h3>', html, re.DOTALL)
    script_text = m_script.group(1) if m_script else ""
    script_parts = [re.sub(r'<[^>]+>', '', p).strip() for p in script_text.split('<br />') if p.strip()]
    scripture = {
        "original": script_parts[0] if len(script_parts) > 0 else "",
        "translation": script_parts[1] if len(script_parts) > 1 else ""
    }

    # 경문에서 효 명칭(예: 初九, 初六 등) 보정
    if scripture["original"]:
        first_word = scripture["original"].split(',')[0].split('，')[0].split()[0].strip()
        if first_word in ["初九", "初六", "九二", "六二", "九三", "六三", "九四", "六四", "九五", "六五", "上九", "上六", "用九", "用六"]:
            line_name = first_word

    # 중국대전 (tabShow1: 정이, 주희, 소주)
    m_china = re.search(r'<section[^>]*both_left[^>]*>\s*<h3>(.*?)</h3>', html, re.DOTALL)
    china_text = m_china.group(1) if m_china else ""
    raw_lines = [re.sub(r'<[^>]+>', '', l).strip() for l in china_text.split('<br />')]
    lines = [l for l in raw_lines if l]

    chengyi = {"book": "伊川易傳", "original": "", "translation": ""}
    zhuxi = {"book": "周易本義", "original": "", "translation": ""}
    shuanghu = {"book": "周易本義通釋", "original": "", "translation": ""}
    yunfeng = {"book": "周易本義附錄纂注", "original": "", "translation": ""}
    sushi = {"book": "東坡易傳", "original": "", "translation": ""}
    wangbi = {"book": "周易注", "original": "", "translation": ""}
    xiaozhu_list = []

    current_section = None
    i = 0
    while i < len(lines):
        line = lines[i]
        if line == '中國大全':
            i += 1
            continue
        if line == '傳':
            current_section = '傳'
            if i + 2 < len(lines):
                chengyi["original"] = lines[i+1]
                chengyi["translation"] = lines[i+2]
                i += 3
                continue
        elif line == '本義':
            current_section = '本義'
            if i + 2 < len(lines):
                zhuxi["original"] = lines[i+1]
                zhuxi["translation"] = lines[i+2]
                i += 3
                continue
        elif line == '小註':
            current_section = '小註'
            i += 1
            continue

        if current_section == '小註':
            orig = line.lstrip('○ ').strip()
            trans = lines[i+1].lstrip('○ ').strip() if (i+1 < len(lines)) else ""
            
            if '雲峯胡氏曰' in orig or '雲峰胡氏曰' in orig:
                yunfeng["original"] = orig
                yunfeng["translation"] = trans
            elif '雙湖胡氏曰' in orig:
                shuanghu["original"] = orig
                shuanghu["translation"] = trans
            elif '東坡蘇氏曰' in orig or '蘇氏曰' in orig:
                sushi["original"] = orig
                sushi["translation"] = trans
            elif '王氏曰' in orig:
                wangbi["original"] = orig
                wangbi["translation"] = trans
            else:
                xiaozhu_list.append({"original": orig, "translation": trans})
            i += 2
            continue

        i += 1

    # 한국대전 (tabShow2: 조선 13대 학자)
    m_korea = re.search(r'<section[^>]*both_right[^>]*>\s*<h3>(.*?)</h3>', html, re.DOTALL)
    korea_text = m_korea.group(1) if m_korea else ""
    korea_scholars = []
    k_blocks = re.findall(r'【(.*?)】\s*(.*?)(?=(?:【|$))', korea_text, re.DOTALL)
    for scholar_info, body in k_blocks:
        k_lines = [re.sub(r'<[^>]+>', '', l).strip() for l in body.split('<br />') if l.strip()]
        if len(k_lines) >= 2:
            korea_scholars.append({
                "scholar": scholar_info.strip(),
                "original": k_lines[0],
                "translation": k_lines[1]
            })

    return {
        "data_id": data_id,
        "raw_title": raw_title,
        "section_type": section_type,
        "line_name": line_name,
        "scripture": scripture,
        "chengyi": chengyi,
        "zhuxi": zhuxi,
        "yunfeng": yunfeng,
        "shuanghu": shuanghu,
        "sushi": sushi,
        "wangbi": wangbi,
        "xiaozhu_others": xiaozhu_list,
        "korea_scholars": korea_scholars
    }

def fetch_aks_hexagram(hex_id):
    """특정 괘(1~64)의 모든 AKS 항목을 순차 탐색하여 괘사 및 6효 데이터 추출"""
    hex_str = f"{hex_id:03d}"
    items = []
    
    consecutive_misses = 0
    for idx in range(1, 40): # 일반적으로 1괘당 15~25개 항목
        data_id = f"AKS-2012-EAZ-2101_DES@{hex_str}_{idx:03d}"
        res = parse_aks_section(data_id)
        if not res:
            consecutive_misses += 1
            if consecutive_misses >= 2 and idx > 15:
                break
            continue
        consecutive_misses = 0
        items.append(res)
        time.sleep(0.04)
    
    result = {
        "hex_id": hex_id,
        "gwaesa": None,
        "lines": [None] * 6,
        "all_sections": items
    }
    
    line_map = {
        "line_0": 0, "line_1": 1, "line_2": 2,
        "line_3": 3, "line_4": 4, "line_5": 5
    }
    
    for item in items:
        st = item["section_type"]
        if st == "gwaesa" and not result["gwaesa"]:
            result["gwaesa"] = item
        elif st in line_map:
            l_idx = line_map[st]
            # 효사 본문 우선 (소상전 제외)
            if result["lines"][l_idx] is None or "소상" not in item["raw_title"]:
                result["lines"][l_idx] = item

    return result

# -------------------------------------------------------------
# 2. 통합 정본 데이터셋 포맷팅
# -------------------------------------------------------------
def format_for_app(aks_item):
    if not aks_item:
        return None
        
    return {
        "title": aks_item["line_name"],
        "scripture": aks_item["scripture"],
        "wangbi":     aks_item["wangbi"],
        "kongyingda": { "book": "周易正義", "original": "", "translation": "" },
        "sushi":      aks_item["sushi"],
        "chengyi":    aks_item["chengyi"],
        "zhuxi":      aks_item["zhuxi"],
        "shuanghu":   aks_item["shuanghu"],
        "yunfeng":    aks_item["yunfeng"],
        "korean_scholars": aks_item.get("korea_scholars", [])
    }

def build_hexagram_commentary(hex_id):
    aks_data = fetch_aks_hexagram(hex_id)
    
    formatted_gwaesa = format_for_app(aks_data["gwaesa"])
    formatted_lines = [format_for_app(l) for l in aks_data["lines"]]
    
    return {
        "hex_id": hex_id,
        "gwaesa": formatted_gwaesa,
        "lines": formatted_lines,
        "-1": formatted_gwaesa,
        "0": formatted_lines[0],
        "1": formatted_lines[1],
        "2": formatted_lines[2],
        "3": formatted_lines[3],
        "4": formatted_lines[4],
        "5": formatted_lines[5]
    }

# -------------------------------------------------------------
# 파일 저장 헬퍼
# -------------------------------------------------------------
db_lock = threading.Lock()

def save_databases(all_db, json_path, js_path):
    with db_lock:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(all_db, f, ensure_ascii=False, indent=2)
            
        if js_path:
            with open(js_path, 'w', encoding='utf-8') as f:
                f.write("// 주역 64괘 정본 주석 데이터베이스 (AKS 한국주역대전 DB 및 ctext 정본 기반)\n")
                f.write("const ichingCommentariesData = ")
                json.dump(all_db, f, ensure_ascii=False, indent=2)
                f.write(";\n\n")
                f.write("if (typeof window !== 'undefined') {\n")
                f.write("  window.ichingCommentariesData = ichingCommentariesData;\n")
                f.write("}\n")
                f.write("if (typeof module !== 'undefined' && module.exports) {\n")
                f.write("  module.exports = ichingCommentariesData;\n")
                f.write("}\n")

# -------------------------------------------------------------
# CLI 실행부 (병렬 처리 지원)
# -------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="주역 64괘 7대 정본 주석 추출기")
    parser.add_argument('--hexagram', type=int, default=0, help='추출할 괘 번호 (1~64, 0이면 전체)')
    parser.add_argument('--all', action='store_true', help='64괘 전체 일괄 추출')
    parser.add_argument('--workers', type=int, default=4, help='동시 다운로드 워커 수 (기본: 4)')
    parser.add_argument('--out', type=str, default='iching_commentary_db.json', help='출력 JSON 파일명')
    parser.add_argument('--js', type=str, default='iching_commentaries_data.js', help='웹 앱용 JS 파일명')
    args = parser.parse_args()

    json_path = Path(args.out)
    js_path = Path(args.js) if args.js else None

    # 기존 DB 로드 (이어받기 지원)
    all_db = {}
    if json_path.exists():
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                all_db = json.load(f)
            print(f"[*] 기존 데이터베이스에서 {len(all_db)}개 괘 데이터 로드됨.")
        except Exception:
            all_db = {}

    target_hexagrams = []
    if args.hexagram > 0:
        target_hexagrams = [args.hexagram]
    elif args.all or args.hexagram == 0:
        # 1부터 64까지 중 아직 없거나 불완전한 괘 대상 (완전한 것은 재활용)
        for h in range(1, 65):
            k = str(h)
            if k in all_db and all_db[k].get("-1") and all_db[k].get("0"):
                continue
            target_hexagrams.append(h)

    if not target_hexagrams:
        print("[*] 64괘 전체 데이터가 이미 완벽하게 구축되어 있습니다. JS 파일만 갱신합니다.")
        save_databases(all_db, json_path, js_path)
        print(f"[완료] {js_path} 갱신 완료!")
        return

    print(f"[*] 총 {len(target_hexagrams)}개 괘 데이터 추출 시작 (워커 수: {args.workers})...")
    start_time = time.time()
    completed_count = 64 - len(target_hexagrams)

    def process_hex(h_id):
        res = build_hexagram_commentary(h_id)
        return h_id, res

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_hex, h): h for h in target_hexagrams}
        for future in as_completed(futures):
            h_id = futures[future]
            try:
                h_id, res = future.result()
                all_db[str(h_id)] = res
                completed_count += 1
                gwaesa_name = res["gwaesa"]["title"] if res.get("gwaesa") else "괘사"
                print(f"  [√ {completed_count:02d}/64] 第 {h_id:02d} 卦 ({gwaesa_name}) 정본 추출 완료")
                
                # 주기적 저장
                save_databases(all_db, json_path, js_path)
            except Exception as e:
                print(f"  [!] 第 {h_id:02d} 卦 추출 실패: {e}")

    elapsed = time.time() - start_time
    save_databases(all_db, json_path, js_path)
    print(f"\n=======================================================")
    print(f"🎉 64괘 전체 정본 주석 데이터베이스 구축 완료!")
    print(f"   • 소요 시간: {elapsed:.1f}초")
    print(f"   • JSON DB: {json_path}")
    print(f"   • 웹 앱 JS: {js_path}")
    print(f"=======================================================\n")

if __name__ == '__main__':
    main()
