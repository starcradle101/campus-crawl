import { crawlActivities } from '@/lib/crawler';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 크롤링 작업 실행
    await crawlActivities();

    // 작업 완료 후 성공 응답
    return NextResponse.json({ message: 'Crawling completed successfully' });
  } catch (error) {
    console.error('Crawling failed:', error);

    // 오류 발생 시 실패 응답
    return NextResponse.json(
      { message: 'Crawling failed', error: error.message },
      { status: 500 }
    );
  }
}
