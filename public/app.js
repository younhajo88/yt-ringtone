const searchForm = document.querySelector('#search-form');
const status = document.querySelector('#status');

if (status) {
  status.textContent = '검색어를 입력하고 벨소리로 만들 영상을 찾아보세요.';
}

if (searchForm && status) {
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = '검색 기능은 다음 단계에서 연결됩니다.';
  });
}
