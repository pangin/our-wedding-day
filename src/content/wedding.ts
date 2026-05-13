export type GalleryImage = {
  id: string;
  src: string;
  alt: string;
  caption: string;
};

export type FamilyLine = {
  father: string;
  mother: string;
  relation: string;
  name: string;
  fullName: string;
};

export type AccountEntry = {
  role: string;
  name: string;
  bank: string;
  number: string;
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
  },
  families: {
    groom: {
      father: '김형찬',
      mother: '이수선',
      relation: '장남',
      name: '성욱',
      fullName: '김성욱',
    },
    bride: {
      father: '김웅열',
      mother: '박경아',
      relation: '장녀',
      name: '혜경',
      fullName: '김혜경',
    },
  } satisfies { groom: FamilyLine; bride: FamilyLine },
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
    lat: 37.5602,
    lng: 126.9737,
  },
  copy: {
    opening:
      '서로의 계절을 오래 바라보다가, 이제 같은 계절을 함께 걸어가려 합니다.',
    invitation:
      '바쁘신 가운데 시간 내어 축복해 주시면 큰 기쁨이 되겠습니다. 두 사람의 첫걸음에 함께해 주세요.',
    accountsHeading: '마음 전하실 곳',
    accountsNote:
      '축하의 자리에 직접 오시기 어려운 분들을 위해 계좌번호를 함께 안내드립니다. 보내주시는 마음, 오래도록 간직하겠습니다.',
    footer: '멀리서 전해주시는 마음도 깊이 간직하겠습니다.',
  },
  images: {
    hero: cloudinaryImage('wedding-2026/iqjox53rjk4ax7oa3avb', 'f_auto,q_auto,w_2200'),
    gallery: [
      {
        id: 'moment-1',
        src: cloudinaryImage('wedding-2026/iqjox53rjk4ax7oa3avb', 'f_auto,q_auto,w_1400,h_1750,c_fill'),
        alt: '벤치에 함께 앉은 신랑 신부',
        caption: '함께한 순간',
      },
      {
        id: 'moment-2',
        src: cloudinaryImage('wedding-2026/hcyzevnmc4hadruvnv3q', 'f_auto,q_auto,w_1400,h_1750,c_fill'),
        alt: '햇살 아래 신랑 신부',
        caption: '눈부신 봄날',
      },
      {
        id: 'moment-3',
        src: cloudinaryImage('wedding-2026/tlbmdtbz0nldzkmpa9w9', 'f_auto,q_auto,w_1400,h_1750,c_fill'),
        alt: '베일 아래 신랑 신부',
        caption: '함께 걷는 길',
      },
    ] satisfies GalleryImage[],
  },
  accounts: {
    groom: [
      { role: '신랑 아버지', name: '김형찬', bank: '신한은행', number: '110-013-712418' },
      { role: '신랑 어머니', name: '이수선', bank: '신한은행', number: '110-111-622620' },
      { role: '신랑', name: '김성욱', bank: '신한은행', number: '110-456-926859' },
    ],
    bride: [
      { role: '신부 아버지', name: '김웅열', bank: '농협은행', number: '352-1326-8109-13' },
      { role: '신부 어머니', name: '박경아', bank: '기업은행', number: '45203-5050-01011' },
      { role: '신부', name: '김혜경', bank: '신한은행', number: '110-196-623602' },
    ],
  } satisfies { groom: AccountEntry[]; bride: AccountEntry[] },
  links: {
    calendarTitle: '성욱과 혜경의 결혼식',
    shareText: '2026년 6월 27일, 성욱과 혜경의 결혼식에 초대합니다.',
  },
};
