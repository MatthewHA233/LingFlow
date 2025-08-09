import csv
import requests
import os
import time
from urllib.parse import urlparse
import re

def sanitize_filename(filename):
    """清理文件名，移除不合法字符"""
    # 移除Windows不允许的字符
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    # 移除控制字符
    filename = re.sub(r'[\x00-\x1f\x7f]', '', filename)
    # 去除首尾空格和点
    filename = filename.strip('. ')
    return filename

def download_voice_demos():
    # 创建下载目录
    download_dir = 'voice_demos'
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
    
    # 读取CSV文件
    csv_path = 'public/音色列表.csv'
    
    with open(csv_path, 'r', encoding='utf-8-sig') as file:  # 使用utf-8-sig处理BOM
        reader = csv.DictReader(file)
        
        total_count = 0
        success_count = 0
        failed_downloads = []
        
        for row in reader:
            voice_id = row.get('voice_type', '').strip()  # 使用voice_type作为ID
            voice_name = row.get('音色名称', '').strip()  # 使用中文列名
            demo_urls = row.get('试听URL', '').strip()  # 使用中文列名
            
            if not demo_urls:
                continue
            
            # 解析试听URL字段
            try:
                url_entries = []
                
                # CSV中的URL是直接的URL字符串，可能包含多个URL（用逗号分隔）
                if demo_urls.startswith('http'):
                    # 处理可能的多个URL（如果有逗号分隔）
                    urls = [url.strip() for url in demo_urls.split(',') if url.strip().startswith('http')]
                    
                    for url in urls:
                        # 从URL中提取语言信息（如果URL中包含中文或英文标识）
                        if '中文' in url or 'chinese' in url.lower() or not any(c in url for c in ['english', 'English', '英文']):
                            url_entries.append({'name': f"{voice_name}_中文", 'url': url})
                        elif '英文' in url or 'english' in url.lower():
                            url_entries.append({'name': f"{voice_name}_英文", 'url': url})
                        else:
                            url_entries.append({'name': voice_name, 'url': url})
                
                # 下载每个URL
                for idx, entry in enumerate(url_entries):
                    demo_name = entry['name']
                    demo_url = entry['url']
                    
                    total_count += 1
                    
                    # 确定文件扩展名
                    parsed_url = urlparse(demo_url)
                    path = parsed_url.path
                    ext = '.mp3' if '.mp3' in path else '.wav'
                    
                    # 生成文件名
                    if len(url_entries) > 1:
                        # 多个试听文件的情况
                        safe_demo_name = sanitize_filename(demo_name)
                        filename = f"{voice_id}_{voice_name}_{safe_demo_name}{ext}"
                    else:
                        # 单个试听文件
                        filename = f"{voice_id}_{voice_name}{ext}"
                    
                    # 清理文件名
                    filename = sanitize_filename(filename)
                    filepath = os.path.join(download_dir, filename)
                    
                    # 如果文件已存在，跳过
                    if os.path.exists(filepath):
                        print(f"✓ 已存在: {filename}")
                        success_count += 1
                        continue
                    
                    # 下载文件
                    try:
                        print(f"下载中 [{total_count}]: {filename}")
                        print(f"  URL: {demo_url}")
                        
                        response = requests.get(demo_url, timeout=30, headers={
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        })
                        
                        if response.status_code == 200:
                            with open(filepath, 'wb') as f:
                                f.write(response.content)
                            print(f"  ✓ 成功: {filename} ({len(response.content)/1024:.1f} KB)")
                            success_count += 1
                        else:
                            print(f"  ✗ 失败: HTTP {response.status_code}")
                            failed_downloads.append({
                                'voice': f"{voice_id}_{voice_name}",
                                'demo': demo_name,
                                'url': demo_url,
                                'error': f"HTTP {response.status_code}"
                            })
                    
                    except requests.exceptions.RequestException as e:
                        print(f"  ✗ 下载失败: {str(e)}")
                        failed_downloads.append({
                            'voice': f"{voice_id}_{voice_name}",
                            'demo': demo_name,
                            'url': demo_url,
                            'error': str(e)
                        })
                    
                    except Exception as e:
                        print(f"  ✗ 意外错误: {str(e)}")
                        failed_downloads.append({
                            'voice': f"{voice_id}_{voice_name}",
                            'demo': demo_name,
                            'url': demo_url,
                            'error': str(e)
                        })
                    
                    # 添加延迟避免请求过快
                    time.sleep(0.5)
            
            except Exception as e:
                print(f"✗ 处理 {voice_name} 时出错: {str(e)}")
                continue
        
        # 打印统计信息
        print("\n" + "="*60)
        print(f"下载完成统计:")
        print(f"  总计: {total_count} 个文件")
        print(f"  成功: {success_count} 个文件")
        print(f"  失败: {len(failed_downloads)} 个文件")
        
        # 如果有失败的下载，保存到文件
        if failed_downloads:
            print(f"\n失败的下载:")
            with open('failed_downloads.txt', 'w', encoding='utf-8') as f:
                for item in failed_downloads:
                    print(f"  - {item['voice']} / {item['demo']}: {item['error']}")
                    f.write(f"{item['voice']} | {item['demo']} | {item['url']} | {item['error']}\n")
            print(f"\n失败详情已保存到 failed_downloads.txt")
        
        print(f"\n所有音频文件已保存到 {os.path.abspath(download_dir)} 目录")

if __name__ == "__main__":
    print("开始下载音色试听文件...")
    print("="*60)
    download_voice_demos()