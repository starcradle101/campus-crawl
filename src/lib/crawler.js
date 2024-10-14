import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';
import * as cheerio from 'cheerio';
import { createClient } from '../../utils/supabase/client';

// 무한 스크롤 함수 (로드된 항목이 100개가 될 때까지 스크롤)
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      let itemCount = document.querySelectorAll('.item').length;
      const maxItems = 100;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        itemCount = document.querySelectorAll('.item').length;

        if (itemCount >= maxItems || totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// 세부 페이지에서 데이터를 추출하는 함수
async function fetchDetails(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    const content = await page.content();
    const $ = cheerio.load(content);

    const title = $('h1').text().trim() || '제목 없음';
    const organization = $('.content p.company').text().trim() || '기관 없음';
    const deadline = $('.dday').text().trim() || '마감일 없음';
    const viewCount = $('.info .viewcount').text().trim() || '조회수 없음';
    const imageUrl = $('.poster img').attr('src') || '';
    const description = $('.description').text().trim() || '설명 없음';

    const reception_period =
      $('.section')
        .filter((_, el) => {
          return $(el).find('h2').text().trim() === '접수 기간';
        })
        .find('p.indent')
        .text()
        .trim() || '접수 기간 없음';

    const reward =
      $('.section')
        .filter((_, el) => {
          return $(el).find('h2').text().trim() === '시상';
        })
        .find('p.indent')
        .text()
        .trim() || '';

    return {
      title,
      organization,
      deadline,
      view_count: viewCount,
      image_url: imageUrl,
      description,
      reception_period,
      reward,
    };
  } catch (error) {
    console.error(`세부 페이지에서 오류 발생 (${url}):`, error);
    return null;
  }
}

// 기존 데이터 조회 함수
async function getExistingActivity(title) {
  const supabase = createClient(); // Supabase 인스턴스를 함수 내부에서 생성
  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('title', title)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('Error fetching existing activity:', error.message);
    return null;
  }
}

// 데이터 비교 및 업데이트 함수
async function upsertActivity(activity) {
  const supabase = createClient(); // Supabase 인스턴스를 함수 내부에서 생성
  try {
    const existingActivity = await getExistingActivity(activity.title);

    if (existingActivity) {
      // 기존 활동이 존재하면 업데이트
      const { error } = await supabase
        .from('activities')
        .update(activity)
        .eq('id', existingActivity.id);

      if (error) throw error;
      console.log('Activity updated successfully:', activity.title);
    } else {
      // 새로운 활동이면 삽입
      const { error } = await supabase.from('activities').insert([activity]);

      if (error) throw error;
      console.log('New activity inserted:', activity.title);
    }
  } catch (error) {
    console.error('Error upserting activity:', error.message);
  }
}

// 메인 크롤링 함수
export async function crawlActivities() {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    const detailUrls = [];

    await page.goto('https://www.campuspick.com/activity', {
      waitUntil: 'networkidle2',
    });

    await autoScroll(page);
    console.log('Page fully scrolled or 100 items loaded');

    const content = await page.content();
    console.log('Page content fetched');

    const $ = cheerio.load(content);

    $('.item').each((index, element) => {
      const href = $(element).find('a.top').attr('href');

      const deadline = $(element).find('.dday').text().trim() || '마감일 없음';
      if (deadline === '마감' || !href) {
        return;
      }

      const detailUrl = 'https://www.campuspick.com' + href;
      detailUrls.push(detailUrl);

      if (detailUrls.length >= 100) {
        return false;
      }
    });

    console.log(`Found ${detailUrls.length} activity URLs`);

    for (const url of detailUrls) {
      const activityData = await fetchDetails(page, url);
      if (activityData) {
        await upsertActivity(activityData);
      }
    }

    console.log('Crawling and data update completed');
  } catch (error) {
    console.error('크롤링 중 오류 발생:', error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}
