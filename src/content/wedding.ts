export type GalleryImage = {
  id: string;
  src: string;
  alt: string;
  caption: string;
};

export type TimelineItem = {
  date: string;
  title: string;
  body: string;
};

const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'demo';
const cloudinaryBaseUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload`;

function cloudinaryImage(publicId: string, transformation: string) {
  return `${cloudinaryBaseUrl}/${transformation}/${publicId}`;
}

export const wedding = {
  couple: {
    groom: '성욱',
    bride: '혜경',
    headline: '우리 결혼합니다',
    families: '양가 가족의 마음을 모아 초대합니다',
  },
  event: {
    date: '2026-06-27T15:00:00+09:00',
    displayDate: '2026년 6월 27일 토요일 오후 3시',
    venue: '오펠리스 웨딩홀',
    hall: '퍼시픽타워 20F 오펠리스',
    address: '서울특별시 중구 세종대로9길 41',
    lotAddress: '서울시 중구 서소문동 135번지',
    phone: '02-2130-2300',
    transit: '서울역 3번 출구 도보 7분 · 시청역 9번 출구 도보 4분',
    parking: '퍼시픽타워 지하주차장 3시간 무료주차 가능',
    mapUrl: 'https://map.naver.com/p/search/%EC%98%A4%ED%8E%A0%EB%A6%AC%EC%8A%A4%20%EC%9B%A8%EB%94%A9%ED%99%80',
  },
  copy: {
    opening:
      '서로의 계절을 오래 바라보다가, 이제 같은 계절을 함께 걸어가려 합니다.',
    invitation:
      '소중한 분들을 모시고 작은 약속의 시간을 갖고자 합니다. 오셔서 따뜻한 마음으로 축복해 주세요.',
    footer: '멀리서 전해주시는 마음도 깊이 간직하겠습니다.',
  },
  images: {
    hero: cloudinaryImage('sample', 'f_auto,q_auto,w_2200'),
    gallery: [
      {
        id: 'walk',
        src: cloudinaryImage('sample', 'f_auto,q_auto,w_1400,h_1750,c_fill'),
        alt: '햇살 아래 함께 걷는 커플',
        caption: '함께 걷는 길',
      },
      {
        id: 'hands',
        src: cloudinaryImage('woman', 'f_auto,q_auto,w_1400,h_1750,c_fill'),
        alt: '손을 맞잡은 커플',
        caption: '작은 약속',
      },
      {
        id: 'bouquet',
        src: cloudinaryImage('coffee', 'f_auto,q_auto,w_1400,h_1750,c_fill'),
        alt: '웨딩 플라워와 예식 공간',
        caption: '기억하고 싶은 순간',
      },
      {
        id: 'table',
        src: cloudinaryImage('balloons', 'f_auto,q_auto,w_1400,h_1750,c_fill'),
        alt: '따뜻한 분위기의 웨딩 테이블',
        caption: '따뜻한 축하',
      },
    ] satisfies GalleryImage[],
  },
  timeline: [
    {
      date: '2019',
      title: '처음 만난 날',
      body: '서툰 인사와 긴 대화가 자연스럽게 다음 약속으로 이어졌습니다.',
    },
    {
      date: '2023',
      title: '서로의 일상',
      body: '좋아하는 것과 어려운 날들을 함께 나누는 사이가 되었습니다.',
    },
    {
      date: '2026',
      title: '결혼식',
      body: '이제 한 가족으로 시작하는 첫날을 여러분과 함께하고 싶습니다.',
    },
  ] satisfies TimelineItem[],
  links: {
    calendarTitle: '성욱과 혜경의 결혼식',
    shareText: '2026년 6월 27일, 성욱과 혜경의 결혼식에 초대합니다.',
  },
};
