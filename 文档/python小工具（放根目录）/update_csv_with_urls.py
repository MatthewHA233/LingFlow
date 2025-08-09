#!/usr/bin/env python3
"""
为音色列表CSV添加试听URL列
自动测试每个URL是否可访问，只保留有效的URL
"""

import csv
import requests
import time
from pathlib import Path
from urllib.parse import quote
import re
from typing import Optional, List, Tuple

# 配置
CSV_FILE = Path("./public/音色列表.csv")
OUTPUT_FILE = Path("./public/音色列表_with_urls.csv")
TEST_URLS = True  # 是否测试URL可访问性
MAX_RETRIES = 2

# 基础URL
BASE_URLS = {
    'portal': 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/',
    'console': 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/console/bigtts/'
}

# 特殊URL（硬编码）
SPECIAL_URLS = {
    'Cartoon Chef': 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/ICL_en_male_cc_sha_v1_tob_eb4a14df-284f-4287-a77d-26432cd0ba63.mp3',
    'ICL_en_male_cc_sha_v1_tob': 'https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/ICL_en_male_cc_sha_v1_tob_eb4a14df-284f-4287-a77d-26432cd0ba63.mp3'
}


def test_url(url: str) -> bool:
    """测试URL是否可访问"""
    if not TEST_URLS:
        return True
    
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.head(url, timeout=5, allow_redirects=True)
            if response.status_code == 200:
                return True
            elif response.status_code == 404:
                return False
        except:
            pass
        
        if attempt < MAX_RETRIES - 1:
            time.sleep(0.5)
    
    return False


def generate_url_for_voice(voice_name: str, voice_type: str) -> List[Tuple[str, str]]:
    """
    为音色生成URL
    返回: [(name_part, url), ...] - 对于包含/的音色会返回多个URL
    """
    results = []
    
    # 清理名称
    clean_name = voice_name.replace('（多情感）', '').replace('(多情感)', '').strip()
    
    # 1. 检查特殊URL映射
    if clean_name in SPECIAL_URLS:
        results.append((clean_name, SPECIAL_URLS[clean_name]))
        return results
    
    # 2. 处理包含斜杠的音色（双语音色）
    if '/' in clean_name:
        parts = clean_name.split('/')
        for part in parts:
            part = part.strip()
            url = generate_single_url(part, voice_type, clean_name)
            if url:
                results.append((part, url))
    else:
        # 3. 单一音色
        url = generate_single_url(clean_name, voice_type, clean_name)
        if url:
            results.append((clean_name, url))
    
    return results


def generate_single_url(name_part: str, voice_type: str, full_name: str) -> Optional[str]:
    """为单个名称部分生成URL"""
    
    # 日语音色特殊处理
    if re.search(r'[ぁ-んァ-ヶー]+[（(].+?[）)]', name_part):
        match = re.search(r'([ぁ-んァ-ヶー]+)[（(](.+?)[）)]', name_part)
        if match:
            kana_name = match.group(1)  # 假名
            kanji_name = match.group(2)  # 汉字
            
            # 特殊情况处理
            if name_part.startswith('ひかる'):
                # ひかる（光）使用假名
                base_url = f"{BASE_URLS['portal']}{quote(kana_name)}"
            elif name_part.startswith('ひろし'):
                # ひろし（広志）使用汉字
                base_url = f"{BASE_URLS['portal']}{quote(kanji_name)}"
            else:
                # 默认使用汉字
                base_url = f"{BASE_URLS['portal']}{quote(kanji_name)}"
            
            # 测试.mp3和.wav
            for ext in ['.mp3', '.wav']:
                url = base_url + ext
                if test_url(url):
                    return url
            return None
    
    # Javier or Álvaro 特殊处理
    if name_part == 'Javier or Álvaro':
        url = f"{BASE_URLS['portal']}Javier.wav"
        if test_url(url):
            return url
        url = f"{BASE_URLS['portal']}Javier.mp3"
        if test_url(url):
            return url
        return None
    
    # 特定的西语音色
    if name_part in ['Lucas', 'Esmeralda', 'Roberto', 'Diana', 'Lucía', 'Sofía', 'Daníel', 'Javier', 'Álvaro']:
        base_url = f"{BASE_URLS['portal']}{name_part}"
        for ext in ['.mp3', '.wav']:
            url = base_url + ext
            if test_url(url):
                return url
    
    # ICL开头的音色
    if voice_type.startswith('ICL_'):
        base_url = f"{BASE_URLS['console']}{voice_type}"
        for ext in ['.mp3', '.wav']:
            url = base_url + ext
            if test_url(url):
                return url
    
    # 纯英文音色（使用console路径）
    if re.match(r'^[a-zA-Z\s\-]+$', name_part) and '/' not in name_part:
        base_url = f"{BASE_URLS['console']}{voice_type}"
        for ext in ['.mp3', '.wav']:
            url = base_url + ext
            if test_url(url):
                return url
        # 如果console路径失败，尝试portal路径
        base_url = f"{BASE_URLS['portal']}{name_part}"
        for ext in ['.mp3', '.wav']:
            url = base_url + ext
            if test_url(url):
                return url
    
    # 中文音色和其他（使用portal路径）
    else:
        base_url = f"{BASE_URLS['portal']}{quote(name_part)}"
        for ext in ['.mp3', '.wav']:
            url = base_url + ext
            if test_url(url):
                return url
    
    return None


def main():
    print("=" * 60)
    print("更新CSV文件，添加试听URL")
    print("=" * 60)
    
    # 读取CSV
    rows = []
    with open(CSV_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        # 如果已经有试听URL列，移除它
        if '试听URL' in headers:
            url_index = headers.index('试听URL')
            headers.pop(url_index)
            for row in reader:
                if len(row) > url_index:
                    row.pop(url_index)
                rows.append(row)
        else:
            rows = list(reader)
    
    # 添加新的试听URL列
    headers.append('试听URL')
    
    # 处理每一行
    processed_rows = []
    success_count = 0
    fail_count = 0
    
    for i, row in enumerate(rows):
        if len(row) < 3:
            row.append('')
            processed_rows.append(row)
            continue
        
        voice_name = row[1]  # 音色名称
        voice_type = row[2]  # voice_type
        
        print(f"\n处理 {i+1}/{len(rows)}: {voice_name}")
        
        # 生成URL
        url_results = generate_url_for_voice(voice_name, voice_type)
        
        if url_results:
            # 如果有多个URL（双语音色），用分号分隔
            if len(url_results) > 1:
                # 格式: 名称1|URL1;名称2|URL2
                url_str = ';'.join([f"{name}|{url}" for name, url in url_results])
            else:
                # 单个URL直接保存
                url_str = url_results[0][1]
            
            row.append(url_str)
            success_count += 1
            print(f"  [OK] 成功: {url_str[:80]}...")
        else:
            row.append('')
            fail_count += 1
            print(f"  [FAIL] 失败: 未找到可用URL")
        
        processed_rows.append(row)
        
        # 避免请求过快
        if TEST_URLS and i % 10 == 0:
            time.sleep(1)
    
    # 写入新CSV
    with open(OUTPUT_FILE, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(processed_rows)
    
    print("\n" + "=" * 60)
    print(f"处理完成！")
    print(f"成功: {success_count} 个")
    print(f"失败: {fail_count} 个")
    print(f"输出文件: {OUTPUT_FILE}")
    
    # 如果成功，替换原文件
    if input("\n是否替换原CSV文件？(y/n): ").lower() == 'y':
        import shutil
        shutil.copy(OUTPUT_FILE, CSV_FILE)
        print(f"已更新: {CSV_FILE}")


if __name__ == '__main__':
    main()