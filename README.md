# 세움스피치학원 홈페이지

React + Vite + Tailwind CSS 로 만든 세움스피치학원 메인 페이지입니다.

## 실행 방법

```bash
npm install      # 처음 한 번만
npm run dev      # 개발 서버 실행 → http://localhost:5173
```

빌드(배포용 파일 생성):

```bash
npm run build    # dist/ 폴더에 생성됨
npm run preview  # 빌드 결과 미리보기
```

## 사진 넣는 법

1. `public/images/` 폴더에 사진 파일을 넣습니다.
2. `src/config.js` 의 `IMAGES` 에 경로를 적습니다.

```js
export const IMAGES = {
  logo: "/images/logo.png",
  heroBg: "/images/hero.jpg",
  course1: "/images/course1.jpg",
  ...
};
```

사진을 비워두면("") 회색 자리표시가 보입니다.

## 전화번호 · 링크 · 메뉴 수정

전부 `src/config.js` 한 파일에서 관리합니다.
- `LINKS.tel` : 상담 전화번호
- `LINKS.kakao` : 카카오톡 상담 주소
- `NAV` : 헤더 메뉴
- `ADDRESS` : 주소 / 영업시간 / 사업자정보

## 폴더 구조

```
seumspeech-site/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ public/
│  ├─ favicon.svg
│  └─ images/          ← 여기에 사진 넣기
└─ src/
   ├─ main.jsx
   ├─ App.jsx          ← 페이지 조립
   ├─ index.css
   ├─ config.js        ← ★ 사진/링크/메뉴 설정
   └─ components/
      ├─ common.jsx        (아이콘, 이미지 자리표시)
      ├─ Header.jsx        (헤더 + 메뉴)
      ├─ FloatingQuick.jsx (우측 상담/카톡 플로팅, 토글)
      ├─ Hero.jsx          (상단 히어로)
      ├─ Courses.jsx       (인기강좌 3개)
      ├─ Quote.jsx         (인용 문구)
      ├─ Steps.jsx         (8단계 학습법)
      ├─ Reviews.jsx       (수강생 후기)
      ├─ Location.jsx      (오시는 길)
      └─ Footer.jsx        (푸터)
```

## 배포 (Vercel)

1. GitHub 에 올린 뒤 Vercel 에 연결하거나
2. `npm run build` 후 `dist/` 폴더를 업로드

Framework Preset 은 자동으로 Vite 로 잡힙니다.
```
