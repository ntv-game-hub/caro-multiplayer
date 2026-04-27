# Requirements: Multiplayer Tic-Tac-Toe / Caro cho trẻ em

## 1. Mục tiêu sản phẩm

Xây dựng một game tic-tac-toe/caro đơn giản, nhiều người chơi cùng lúc, ưu tiên trải nghiệm mobile. Game dành cho trẻ em nên giao diện cần sinh động, tươi mới, nhiều hoạt họa, icon đẹp, thao tác dễ hiểu và tập trung chủ yếu vào bàn cờ.

Người chơi không cần đăng ký hoặc đăng nhập. Một người tạo phòng, những người khác thấy danh sách phòng, tham gia phòng, nhập tên và chơi ngay.

## 2. Đối tượng sử dụng

- Trẻ em chơi trên điện thoại là chính.
- Nhóm bạn hoặc lớp học nhỏ muốn vào cùng một phòng để chơi nhanh.
- Người tạo phòng có thể giới hạn số người tham gia.

## 3. Nền tảng và ưu tiên thiết kế

- Ưu tiên mobile-first.
- Có thể chạy tốt trên trình duyệt mobile.
- Desktop/tablet vẫn dùng được nhưng không phải ưu tiên chính.
- UI phải dành phần lớn không gian cho bàn cờ.
- Các khu vực phụ như danh sách phòng, thông tin phòng, lịch sử, cài đặt phải gọn, ít chiếm không gian.

## 4. Luồng chính

### 4.1. Vào game

- Người chơi vào trang chính và thấy danh sách phòng đang mở.
- Người chơi có thể:
  - Tạo phòng mới.
  - Chọn một phòng trong danh sách để tham gia.
- Nếu đã từng nhập tên, hệ thống tự điền tên từ `localStorage`.

### 4.2. Tạo phòng

- Người tạo phòng nhập tên người chơi nếu chưa có.
- Người tạo phòng nhập hoặc tạo tên phòng/mã phòng.
- Tên phòng/mã phòng xuất hiện trên URL để reload trang không mất ngữ cảnh phòng.
- Chủ phòng có thể custom số người tối đa được tham gia.
- Sau khi tạo phòng, chủ phòng vào ngay màn chơi.

### 4.3. Tham gia phòng

- Người chơi thấy list phòng đang có.
- Người chơi chọn phòng, nhập tên nếu chưa có, rồi join.
- Nếu phòng đã đầy, hiển thị thông báo thân thiện.
- Nếu tên bị trùng trong cùng phòng, hệ thống cần xử lý một trong hai cách:
  - Yêu cầu đổi tên.
  - Hoặc tự thêm hậu tố dễ hiểu, ví dụ `An 2`.

### 4.4. Reload và quay lại phòng

- URL chứa tên phòng/mã phòng.
- Khi reload trang trong phòng:
  - Tự đọc room từ URL.
  - Tự đọc tên người chơi từ `localStorage`.
  - Tự reconnect vào phòng nếu còn hợp lệ.
- Nếu phòng không còn tồn tại, hiển thị trạng thái phòng đã kết thúc hoặc không tìm thấy.

## 5. Luật chơi

### 5.1. Kiểu game

- Game là tic-tac-toe/caro nhiều người.
- Một người có thể đấu cùng lúc với nhiều người khác trong cùng một phòng.
- Board game không giới hạn số nước đi theo kiểu bàn cờ mở rộng.
- Người chơi lần lượt đặt quân trên bàn cờ.
- Mỗi người có ký hiệu/màu/icon riêng để trẻ em dễ nhận diện.

### 5.2. Điều kiện thắng

- Khi một người đạt điều kiện thắng trước, người đó dừng chơi.
- Những người chơi còn lại vẫn tiếp tục chơi.
- Game chỉ kết thúc hoàn toàn khi không còn đủ người để tiếp tục hoặc khi phòng/chủ phòng kết thúc ván.
- Cần lưu lại thứ tự thắng, ví dụ:
  - Hạng 1: người thắng đầu tiên.
  - Hạng 2: người thắng tiếp theo.
  - Những người còn lại tiếp tục cho đến khi ván kết thúc.

Ghi chú triển khai: số quân liên tiếp để thắng có thể mặc định là 5 như caro. Nếu muốn đúng tic-tac-toe truyền thống thì có thể đặt là 3, nhưng vì board không giới hạn nước đi nên mặc định nên là 5.

### 5.3. Người chơi đã thắng

- Người đã thắng:
  - Không còn lượt đặt quân.
  - Vẫn nhìn được diễn biến ván chơi.
  - Được hiển thị trạng thái đã thắng trên thanh người chơi.
- Các quân đã đặt trước đó vẫn nằm trên bàn cờ.

### 5.4. Người chơi còn lại

- Những người chưa thắng tiếp tục chơi theo lượt.
- Nếu lượt hiện tại thuộc về người đã thắng hoặc đã rời phòng, lượt được chuyển sang người chơi hợp lệ kế tiếp.

## 6. Phòng chơi

### 6.1. Thông tin phòng

Trên màn chơi cần hiển thị gọn ở phía trên:

- Tên phòng.
- Mã phòng hoặc slug phòng.
- Số người đang tham gia / số người tối đa.
- Danh sách người chơi.
- Trạng thái từng người chơi:
  - Đang chơi.
  - Đến lượt.
  - Đã thắng.
  - Mất kết nối hoặc rời phòng.

### 6.2. Danh sách phòng

Màn danh sách phòng cần hiển thị:

- Tên phòng/mã phòng.
- Số người hiện tại / số người tối đa.
- Trạng thái phòng:
  - Đang chờ.
  - Đang chơi.
  - Đã đầy.
- Nút join nhanh.

### 6.3. Chủ phòng

Chủ phòng là người tạo phòng.

Chủ phòng có quyền:

- Chọn số người tối đa được tham gia khi tạo phòng.
- Bắt đầu ván nếu cần cơ chế chờ.
- Kết thúc hoặc tạo ván mới.

Không cần hệ thống tài khoản nên quyền chủ phòng có thể gắn với session/local player id.

## 7. Dữ liệu người chơi

### 7.1. Local storage

Lưu vào `localStorage`:

- Tên người chơi gần nhất.
- Player id/session id để hỗ trợ reconnect.
- Lịch sử chơi theo tên người chơi.

### 7.2. Lịch sử chơi

Lưu lịch sử chơi dựa theo tên người chơi.

Mỗi bản ghi lịch sử nên có:

- Tên người chơi.
- Tên/mã phòng.
- Thời gian chơi.
- Kết quả:
  - Thứ hạng nếu thắng.
  - Đã tham gia nhưng chưa thắng.
  - Rời phòng hoặc ván bị hủy.
- Số nước đã đi.
- Danh sách người chơi trong phòng tại thời điểm ván chơi.

Lịch sử ưu tiên lưu cục bộ trước. Nếu có backend realtime, có thể đồng bộ thêm ở server.

## 8. UI/UX

### 8.1. Phong cách hình ảnh

- Tươi sáng, thân thiện với trẻ em.
- Dùng màu sắc vui nhộn nhưng không gây rối mắt.
- Icon rõ ràng, đẹp, dễ hiểu.
- Có animation khi:
  - Vào phòng.
  - Người chơi join.
  - Đến lượt người chơi.
  - Đặt quân.
  - Có người thắng.
  - Chuyển lượt.
- Tránh các màn hướng dẫn dài hoặc layout marketing.

### 8.2. Màn chơi

- Bàn cờ là trung tâm, chiếm phần lớn màn hình.
- Header phía trên thật gọn:
  - Tên phòng/mã phòng.
  - Số người tham gia.
  - Dãy avatar/icon người chơi.
- Có thể dùng bottom sheet hoặc panel nhỏ để mở:
  - Lịch sử.
  - Danh sách người chơi chi tiết.
  - Cài đặt phòng.
- Trên mobile, thao tác chạm ô cờ phải lớn và dễ bấm.

### 8.3. Board không giới hạn

- Bàn cờ cần hỗ trợ mở rộng theo hướng người chơi đặt quân.
- Có thể pan/drag để di chuyển bàn cờ.
- Có thể zoom nếu cần, nhưng thao tác đặt quân phải không bị khó.
- Khi người chơi đặt quân ở rìa, board tự mở rộng hoặc cho phép cuộn đến vùng mới.

### 8.4. Trạng thái lượt

- Luôn hiển thị rõ ai đang tới lượt.
- Người tới lượt cần có animation hoặc viền nổi bật.
- Nếu tới lượt người chơi hiện tại, hiển thị tín hiệu rõ nhưng gọn.

### 8.5. Trạng thái thắng

- Khi có người thắng:
  - Hiển thị animation vui.
  - Gắn nhãn/huy hiệu chiến thắng cho người đó.
  - Không làm gián đoạn những người còn lại quá lâu.
- Những người còn lại tiếp tục thấy board và chơi tiếp.

## 9. Realtime và đồng bộ

Game cần đồng bộ realtime giữa người chơi trong cùng phòng:

- Người chơi join/rời phòng.
- Số người trong phòng.
- Lượt hiện tại.
- Nước đi mới.
- Trạng thái thắng.
- Kết thúc ván hoặc tạo ván mới.

Khi mất kết nối:

- Hiển thị trạng thái mất kết nối.
- Cho phép reconnect bằng URL phòng và dữ liệu trong `localStorage`.
- Không làm mất lịch sử cục bộ.

## 10. Các màn hình chính

### 10.1. Home / Room List

- Danh sách phòng.
- Nút tạo phòng.
- Input tên người chơi gọn.
- Join phòng nhanh.

### 10.2. Create Room

- Tên/mã phòng.
- Số người tối đa.
- Tên chủ phòng nếu chưa có.
- Nút tạo phòng.

### 10.3. Game Room

- Header thông tin phòng.
- Danh sách người chơi compact.
- Bàn cờ chính.
- Trạng thái lượt.
- Các action phụ gọn:
  - Copy link phòng.
  - Xem lịch sử.
  - Rời phòng.
  - Tạo ván mới nếu là chủ phòng.

### 10.4. History

- Lịch sử chơi theo tên người chơi.
- Hiển thị gọn, có thể mở trong bottom sheet hoặc modal.

## 11. Yêu cầu kỹ thuật đề xuất

- Ứng dụng web realtime dùng Node.js + Express + Socket.IO.
- Không bắt buộc đăng ký/đăng nhập.
- URL chứa room slug/id.
- `localStorage` lưu tên người chơi, player id và lịch sử.
- Server Socket.IO lưu trạng thái phòng, người chơi, board và lượt chơi hiện tại.
- State game cần chịu được reload/reconnect.
- Board nên lưu theo tọa độ thay vì mảng cố định, ví dụ key dạng `x:y`.
- Frontend có thể dùng React/Vite hoặc framework nhẹ tương đương.
- Backend và frontend có thể deploy chung trong một Node.js app để chạy đơn giản trên local machine.

## 12. Yêu cầu deploy bằng PM2 trên local machine

Dự án cần được implement theo hướng đơn giản, dễ chạy trên một máy local/server riêng bằng PM2. Không cần cân nhắc deploy lên Vercel, Render hoặc các nền tảng serverless.

### 12.1. Kiến trúc đề xuất

- Một Node.js server chạy Express + Socket.IO.
- Frontend build static và được Express serve trực tiếp.
- Socket.IO chạy cùng HTTP server để tránh phải cấu hình nhiều service.
- Trạng thái realtime của phòng/game có thể lưu trong memory cho MVP.
- Không cần database bắt buộc cho MVP.
- Không cần Docker cho MVP.
- Khi server restart, các phòng đang chơi có thể mất trạng thái. Đây là giới hạn chấp nhận được cho bản đơn giản.
- Nếu sau này cần lưu phòng bền hơn qua restart, có thể bổ sung Redis hoặc database.

### 12.2. Yêu cầu cấu hình

- Có thể chạy local bằng một lệnh rõ ràng, ví dụ `npm run dev`.
- Có thể build bằng `npm run build`.
- Có thể chạy production bằng một lệnh rõ ràng, ví dụ `npm start`.
- Có script PM2 hoặc hướng dẫn PM2 đơn giản, ví dụ:
  - `pm2 start npm --name caro-multiplayer -- start`
  - `pm2 save`
  - `pm2 startup`
- Server đọc port từ biến môi trường `PORT`, mặc định có thể là `3000`.
- Cấu hình CORS chỉ cần thiết nếu frontend và backend chạy khác origin; mặc định nên serve chung để đơn giản.
- Có file hướng dẫn deploy local machine, ví dụ `README.md`, với các bước:
  - Install dependencies.
  - Build frontend.
  - Start bằng PM2.
  - Restart/stop/logs bằng PM2.

### 12.3. Lưu trữ trạng thái

- Với MVP, trạng thái phòng/game được lưu trong memory của Node.js process.
- Cách này giúp triển khai đơn giản nhất khi chạy bằng PM2 trên một máy.
- Cần chấp nhận rằng khi process restart, server reboot hoặc deploy lại, phòng đang chơi sẽ mất.
- `localStorage` chỉ dùng cho dữ liệu cá nhân trên máy người chơi:
  - Tên người chơi.
  - Player id/session id.
  - Lịch sử cục bộ.
- Dữ liệu cần chia sẻ giữa nhiều người chơi nằm trong state của Socket.IO server.
- Lịch sử chơi dựa theo tên người chơi vẫn ưu tiên lưu ở client bằng `localStorage`.

### 12.4. Tiêu chí deploy MVP bằng PM2

- App chạy được trên local machine bằng PM2.
- Một port duy nhất phục vụ cả frontend và Socket.IO.
- Sau khi start bằng PM2, người chơi trong cùng mạng hoặc qua domain/proxy có thể truy cập game.
- Người chơi có thể tạo phòng, copy link, reload URL phòng và join từ thiết bị khác.
- Có hướng dẫn cấu hình reverse proxy nếu cần public qua domain, ví dụ Nginx proxy tới `localhost:3000`.
- Không phụ thuộc vào dịch vụ cloud realtime/storage bên ngoài cho MVP.

## 13. Edge cases

- Join phòng không tồn tại.
- Join phòng đã đầy.
- Người chơi reload khi đang đến lượt.
- Người chơi rời phòng khi đang đến lượt.
- Người chơi đã thắng nhưng reload lại.
- Hai người đặt cùng một ô gần như đồng thời.
- Tên người chơi trùng trong cùng phòng.
- Chủ phòng rời phòng.
- Phòng không còn người chơi.
- Board quá lớn sau nhiều nước đi.

## 14. Tiêu chí hoàn thành MVP

- Người chơi tạo phòng không cần tài khoản.
- Người khác thấy phòng trong danh sách và join được.
- Tên phòng/mã phòng nằm trên URL.
- Reload trong phòng không mất tên người chơi và có thể reconnect.
- Chủ phòng chọn được số người tối đa.
- Nhiều người chơi cùng ván được.
- Board không giới hạn theo tọa độ.
- Người thắng trước dừng chơi, người còn lại tiếp tục.
- Hiển thị danh sách người chơi, số người, trạng thái lượt và trạng thái thắng.
- Lưu lịch sử chơi theo tên người chơi trong `localStorage`.
- UI mobile-first, sinh động, nhiều animation, icon đẹp, bàn cờ là trọng tâm.
