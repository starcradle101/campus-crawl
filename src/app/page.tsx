import { createClient } from '../../utils/supabase/server';

// Supabase 클라이언트 생성
const supabase = createClient();

// Page 컴포넌트
export default async function Page() {
  // Supabase에서 크롤링된 데이터를 가져오는 함수
  const { data: activities, error } = await supabase
    .from('activities') // 'activities' 테이블에서 데이터 가져옴
    .select('*'); // 모든 컬럼을 선택

  if (error) {
    return <div>Error fetching activities: {error.message}</div>;
  }

  return (
    <div>
      <h1>Crawled Activities Data</h1>
      {/* 데이터를 JSON 형태로 렌더링 */}
      <pre>{JSON.stringify(activities, null, 2)}</pre>
    </div>
  );
}
