const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'public', 'uploads'), { recursive: true });

const seed = {
  users: [
    { id: 1, name: 'Quản trị viên', email: 'admin@studio.local', phone: '0900000001', address: '', password: bcrypt.hashSync('Admin123!', 10), role: 'admin', active: true },
    { id: 2, name: 'Nhân viên bán hàng', email: 'staff@studio.local', phone: '0900000002', address: '', password: bcrypt.hashSync('Staff123!', 10), role: 'staff', active: true },
    { id: 3, name: 'Khách hàng demo', email: 'customer@studio.local', phone: '0900000003', address: 'Đà Nẵng', password: bcrypt.hashSync('Customer123!', 10), role: 'customer', active: true }
  ],
  products: [
    { id: 1, name: 'Áo thun Essential', category: 'Áo', price: 189000, image: '/public/images/shirt.svg', description: 'Áo thun cotton mềm mại, kiểu dáng tối giản phù hợp mặc hằng ngày.', variants: [{ size: 'S', color: 'Trắng', stock: 12 }, { size: 'M', color: 'Trắng', stock: 20 }, { size: 'L', color: 'Đen', stock: 10 }, { size: 'XL', color: 'Đen', stock: 8 }], active: true, createdAt: new Date().toISOString() },
    { id: 2, name: 'Sơ mi Classic', category: 'Áo', price: 329000, image: '/public/images/shirt-classic.svg', description: 'Sơ mi thanh lịch cho đi học, đi làm và những dịp gặp gỡ.', variants: [{ size: 'S', color: 'Trắng', stock: 8 }, { size: 'M', color: 'Xanh nhạt', stock: 14 }, { size: 'L', color: 'Trắng', stock: 10 }, { size: 'XL', color: 'Xanh nhạt', stock: 5 }], active: true, createdAt: new Date().toISOString() },
    { id: 3, name: 'Quần ống rộng Urban', category: 'Quần', price: 399000, image: '/public/images/pants.svg', description: 'Chất vải đứng phom, dễ phối cùng áo thun hoặc sơ mi.', variants: [{ size: 'S', color: 'Đen', stock: 7 }, { size: 'M', color: 'Đen', stock: 13 }, { size: 'L', color: 'Be', stock: 9 }, { size: 'XL', color: 'Be', stock: 4 }], active: true, createdAt: new Date().toISOString() },
    { id: 4, name: 'Áo khoác Daily', category: 'Áo khoác', price: 549000, image: '/public/images/jacket.svg', description: 'Áo khoác nhẹ, tiện dụng cho những ngày thời tiết se lạnh.', variants: [{ size: 'S', color: 'Be', stock: 5 }, { size: 'M', color: 'Đen', stock: 8 }, { size: 'L', color: 'Đen', stock: 6 }, { size: 'XL', color: 'Be', stock: 3 }], active: true, createdAt: new Date().toISOString() }
  ],
  orders: [],
  nextUserId: 4,
  nextProductId: 5,
  nextOrderId: 1
};

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
function loadStore() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2)); return JSON.parse(JSON.stringify(seed)); }
}
let store = loadStore();
// Backfill local demo images when upgrading an existing data/store.json.
let imagesUpdated = false;
for (const product of store.products) {
  const seededProduct = seed.products.find(item => item.id === product.id);
  if (seededProduct && !product.image) { product.image = seededProduct.image; imagesUpdated = true; }
}
if (imagesUpdated) fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
function saveStore() { fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2)); }
function money(n) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(n) || 0); }
function safeUser(u) { if (!u) return null; const { password, ...rest } = u; return rest; }

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(session({
  name: 'studio.sid',
  secret: process.env.SESSION_SECRET || 'studio-fashion-local-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}));
app.use((req, res, next) => {
  res.locals.currentUser = safeUser(store.users.find(u => u.id === req.session.userId));
  res.locals.cartCount = Object.values(req.session.cart || {}).reduce((sum, item) => sum + item.qty, 0);
  res.locals.money = money;
  res.locals.notice = req.session.notice || null;
  delete req.session.notice;
  next();
});
function notice(req, message, type = 'success') { req.session.notice = { message, type }; }
function requireLogin(req, res, next) {
  if (!req.session.userId) { notice(req, 'Vui lòng đăng nhập để tiếp tục.', 'warning'); return res.redirect('/login'); }
  const user = store.users.find(u => u.id === req.session.userId);
  if (!user || !user.active) { req.session.destroy(() => {}); return res.redirect('/login'); }
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    const user = store.users.find(u => u.id === req.session.userId);
    if (!user) return res.redirect('/login');
    if (!roles.includes(user.role)) return res.status(403).render('error', { title: 'Không có quyền truy cập', message: 'Tài khoản của bạn không có quyền sử dụng chức năng này.' });
    next();
  };
}
function redirectByRole(user) { return user.role === 'admin' ? '/admin' : user.role === 'staff' ? '/staff' : '/account'; }
function findProduct(id) { return store.products.find(p => p.id === Number(id) && p.active); }

app.get('/', (req, res) => {
  const products = store.products.filter(p => p.active).slice(0, 4);
  res.render('home', { title: 'Trang chủ', products });
});
app.get('/shop', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const category = req.query.category || '';
  let products = store.products.filter(p => p.active);
  if (q) products = products.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  if (category) products = products.filter(p => p.category === category);
  const categories = [...new Set(store.products.filter(p => p.active).map(p => p.category))];
  res.render('shop', { title: 'Cửa hàng', products, categories, q, category });
});
app.get('/product/:id', (req, res) => {
  const product = findProduct(req.params.id);
  if (!product) return res.status(404).render('error', { title: 'Không tìm thấy sản phẩm', message: 'Sản phẩm không tồn tại hoặc đã ngừng bán.' });
  res.render('product', { title: product.name, product });
});

app.get('/register', (req, res) => res.render('auth', { title: 'Đăng ký', mode: 'register' }));
app.post('/register', async (req, res) => {
  const name = (req.body.name || '').trim(), email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!name || !email || password.length < 8) { notice(req, 'Vui lòng nhập họ tên, email và mật khẩu tối thiểu 8 ký tự.', 'danger'); return res.redirect('/register'); }
  if (store.users.some(u => u.email === email)) { notice(req, 'Email này đã được đăng ký.', 'danger'); return res.redirect('/register'); }
  const user = { id: store.nextUserId++, name, email, phone: '', address: '', password: await bcrypt.hash(password, 10), role: 'customer', active: true };
  store.users.push(user); saveStore();
  req.session.userId = user.id; notice(req, 'Đăng ký thành công. Chào mừng bạn đến STUDIO!'); res.redirect('/account');
});
app.get('/login', (req, res) => res.render('auth', { title: 'Đăng nhập', mode: 'login' }));
app.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase(), password = req.body.password || '';
  const user = store.users.find(u => u.email === email);
  if (!user || !user.active || !(await bcrypt.compare(password, user.password))) {
    notice(req, 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.', 'danger'); return res.redirect('/login');
  }
  req.session.userId = user.id;
  notice(req, 'Đăng nhập thành công.');
  res.redirect(redirectByRole(user));
});
app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/cart', (req, res) => {
  const cart = req.session.cart || {};
  const items = Object.values(cart).map(item => {
    const product = store.products.find(p => p.id === item.productId);
    return product ? { ...item, product, subtotal: product.price * item.qty } : null;
  }).filter(Boolean);
  res.render('cart', { title: 'Giỏ hàng', items, total: items.reduce((sum, i) => sum + i.subtotal, 0) });
});
app.post('/cart/add', (req, res) => {
  const product = findProduct(req.body.productId);
  const qty = Math.max(1, Math.min(99, Number.parseInt(req.body.qty, 10) || 1));
  const size = req.body.size || 'M', color = req.body.color || 'Mặc định';
  if (!product) { notice(req, 'Sản phẩm không tồn tại.', 'danger'); return res.redirect('/shop'); }
  const variant = product.variants.find(v => v.size === size && v.color === color);
  if (!variant || variant.stock < qty) { notice(req, 'Size/màu đã chọn không đủ tồn kho.', 'danger'); return res.redirect('/product/' + product.id); }
  const key = `${product.id}-${size}-${color}`;
  req.session.cart ||= {};
  const newQty = (req.session.cart[key]?.qty || 0) + qty;
  if (newQty > variant.stock) { notice(req, 'Số lượng trong giỏ vượt quá tồn kho.', 'danger'); return res.redirect('/cart'); }
  req.session.cart[key] = { key, productId: product.id, size, color, qty: newQty };
  notice(req, 'Đã thêm sản phẩm vào giỏ hàng.'); res.redirect('/cart');
});
app.post('/cart/update', (req, res) => {
  const key = String(req.body.key || '');
  const item = req.session.cart?.[key];
  const qty = Number.parseInt(req.body.qty, 10);
  if (!item) { notice(req, 'Không tìm thấy sản phẩm trong giỏ hàng.', 'danger'); return res.redirect('/cart'); }
  if (!Number.isInteger(qty) || qty < 1) { notice(req, 'Số lượng phải từ 1 trở lên.', 'danger'); return res.redirect('/cart'); }
  const product = store.products.find(p => p.id === item.productId);
  const variant = product?.variants.find(v => v.size === item.size && v.color === item.color);
  if (!product || !variant) { delete req.session.cart[key]; notice(req, 'Biến thể sản phẩm không còn tồn tại, đã xóa khỏi giỏ.', 'warning'); return res.redirect('/cart'); }
  if (qty > variant.stock) { notice(req, `Kho chỉ còn ${variant.stock} sản phẩm cho size ${item.size}, màu ${item.color}.`, 'warning'); return res.redirect('/cart'); }
  item.qty = qty;
  notice(req, 'Đã cập nhật giỏ hàng.');
  res.redirect('/cart');
});
app.post('/cart/remove', (req, res) => {
  const key = String(req.body.key || '');
  if (req.session.cart && Object.prototype.hasOwnProperty.call(req.session.cart, key)) {
    delete req.session.cart[key];
    notice(req, 'Đã xóa sản phẩm khỏi giỏ hàng.');
  }
  res.redirect('/cart');
});

app.get('/checkout', requireLogin, (req, res) => {
  const cart = req.session.cart || {};
  const items = Object.values(cart).map(i => ({ ...i, product: store.products.find(p => p.id === i.productId) })).filter(i => i.product);
  if (!items.length) { notice(req, 'Giỏ hàng đang trống.', 'warning'); return res.redirect('/shop'); }
  const total = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  res.render('checkout', { title: 'Thanh toán', items, total, user: store.users.find(u => u.id === req.session.userId) });
});
app.post('/checkout', requireLogin, (req, res) => {
  const cart = req.session.cart || {};
  const items = Object.values(cart).map(i => ({ ...i, product: store.products.find(p => p.id === i.productId) })).filter(i => i.product);
  if (!items.length) return res.redirect('/shop');
  const customer = store.users.find(u => u.id === req.session.userId);
  const { name, phone, address, payment } = req.body;
  if (!name?.trim() || !phone?.trim() || !address?.trim()) { notice(req, 'Vui lòng điền đủ tên, số điện thoại và địa chỉ.', 'danger'); return res.redirect('/checkout'); }
  for (const item of items) {
    const variant = item.product.variants.find(v => v.size === item.size && v.color === item.color);
    if (!variant || variant.stock < item.qty) { notice(req, `Sản phẩm ${item.product.name} không đủ tồn kho.`, 'danger'); return res.redirect('/cart'); }
  }
  for (const item of items) {
    const variant = item.product.variants.find(v => v.size === item.size && v.color === item.color);
    variant.stock -= item.qty;
  }
  const total = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const order = { id: store.nextOrderId++, userId: customer.id, customerName: name.trim(), phone: phone.trim(), address: address.trim(), payment: ['COD','VietQR','EWallet'].includes(payment) ? payment : 'COD', paymentStatus: payment === 'COD' ? 'Chưa thanh toán' : 'Chờ xác nhận', status: 'Chờ duyệt', items: items.map(i => ({ productId: i.product.id, name: i.product.name, price: i.product.price, size: i.size, color: i.color, qty: i.qty })), total, createdAt: new Date().toISOString() };
  store.orders.push(order); saveStore(); req.session.cart = {};
  notice(req, `Đặt hàng thành công! Mã đơn #${order.id}.`); res.redirect('/account/orders');
});
app.get('/account', requireLogin, (req, res) => res.render('account', { title: 'Tài khoản', user: store.users.find(u => u.id === req.session.userId) }));
app.post('/account', requireLogin, (req, res) => {
  const user = store.users.find(u => u.id === req.session.userId);
  user.name = (req.body.name || user.name).trim(); user.phone = (req.body.phone || '').trim(); user.address = (req.body.address || '').trim();
  saveStore(); notice(req, 'Đã cập nhật thông tin tài khoản.'); res.redirect('/account');
});
app.get('/account/orders', requireLogin, (req, res) => {
  const orders = store.orders.filter(o => o.userId === req.session.userId).sort((a,b) => b.id-a.id);
  res.render('orders', { title: 'Lịch sử đơn hàng', orders, staffView: false });
});
app.get('/change-password', requireLogin, (req, res) => res.render('password', { title: 'Đổi mật khẩu' }));
app.post('/change-password', requireLogin, async (req, res) => {
  const user = store.users.find(u => u.id === req.session.userId);
  if (!(await bcrypt.compare(req.body.currentPassword || '', user.password))) { notice(req, 'Mật khẩu hiện tại không đúng.', 'danger'); return res.redirect('/change-password'); }
  if (!req.body.newPassword || req.body.newPassword.length < 8) { notice(req, 'Mật khẩu mới phải có ít nhất 8 ký tự.', 'danger'); return res.redirect('/change-password'); }
  user.password = await bcrypt.hash(req.body.newPassword, 10); saveStore(); notice(req, 'Đổi mật khẩu thành công.'); res.redirect('/account');
});

app.get('/staff', requireLogin, requireRole('staff','admin'), (req, res) => {
  const orders = [...store.orders].sort((a,b) => b.id-a.id);
  const stock = store.products.filter(p => p.active).map(p => ({ ...p, totalStock: p.variants.reduce((s,v)=>s+v.stock,0) }));
  res.render('staff', { title: 'Bảng điều khiển nhân viên', orders, stock });
});
app.post('/staff/orders/:id/status', requireLogin, requireRole('staff','admin'), (req, res) => {
  const order = store.orders.find(o => o.id === Number(req.params.id));
  if (!order) { notice(req, 'Không tìm thấy đơn hàng.', 'danger'); return res.redirect('/staff'); }
  const allowed = ['Đã duyệt','Đang giao','Hoàn thành','Đã hủy'];
  if (allowed.includes(req.body.status)) { order.status = req.body.status; if (order.status === 'Hoàn thành' && order.payment === 'COD') order.paymentStatus = 'Đã thanh toán'; saveStore(); notice(req, 'Đã cập nhật trạng thái đơn hàng.'); }
  res.redirect('/staff');
});

app.get('/admin', requireLogin, requireRole('admin'), (req, res) => {
  const completed = store.orders.filter(o => o.status === 'Hoàn thành');
  const revenue = completed.reduce((s,o)=>s+o.total,0);
  const month = new Date().toISOString().slice(0,7);
  const monthRevenue = completed.filter(o=>o.createdAt.startsWith(month)).reduce((s,o)=>s+o.total,0);
  res.render('admin', { title: 'Quản trị hệ thống', revenue, monthRevenue, completedCount: completed.length, userCount: store.users.filter(u=>u.role==='customer').length, productCount: store.products.filter(p=>p.active).length, orders: [...store.orders].sort((a,b)=>b.id-a.id) });
});
const upload = multer({ storage: multer.diskStorage({ destination: path.join(__dirname,'public','uploads'), filename: (req,file,cb)=>cb(null, Date.now() + path.extname(file.originalname).toLowerCase()) }), limits: { fileSize: 4 * 1024 * 1024 }, fileFilter: (req,file,cb)=>cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) });
app.get('/admin/products', requireLogin, requireRole('admin'), (req,res)=>res.render('admin-products',{title:'Quản lý sản phẩm',products:store.products}));
app.post('/admin/products', requireLogin, requireRole('admin'), upload.single('image'), (req,res)=>{
  const name=(req.body.name||'').trim(), category=(req.body.category||'').trim(), price=Number(req.body.price);
  if(!name || !category || !Number.isFinite(price) || price<0){notice(req,'Vui lòng nhập tên, danh mục và giá hợp lệ.','danger');return res.redirect('/admin/products');}
  const sizes=['S','M','L','XL'], colors=(req.body.colors||'Đen,Trắng').split(',').map(s=>s.trim()).filter(Boolean);
  const variants=[]; for(const size of sizes) for(const color of colors) variants.push({size,color,stock:Math.max(0,Number(req.body.stock)||0)});
  store.products.push({id:store.nextProductId++,name,category,price,image:req.file?'/public/uploads/'+req.file.filename:'',description:(req.body.description||'').trim(),variants,active:true,createdAt:new Date().toISOString()});saveStore();notice(req,'Đã thêm sản phẩm.');res.redirect('/admin/products');
});
app.post('/admin/products/:id/delete', requireLogin, requireRole('admin'), (req,res)=>{const p=store.products.find(p=>p.id===Number(req.params.id));if(p){p.active=false;saveStore();notice(req,'Đã ẩn sản phẩm khỏi cửa hàng.');}res.redirect('/admin/products');});
app.post('/admin/products/:id/stock', requireLogin, requireRole('admin'), (req,res)=>{
  const p=store.products.find(p=>p.id===Number(req.params.id)); if(p){const idx=Number(req.body.variantIndex),stock=Number(req.body.stock);if(p.variants[idx]&&Number.isInteger(stock)&&stock>=0){p.variants[idx].stock=stock;saveStore();notice(req,'Đã cập nhật tồn kho.');}}res.redirect('/admin/products');
});
app.get('/admin/users', requireLogin, requireRole('admin'), (req,res)=>res.render('admin-users',{title:'Quản lý tài khoản',users:store.users.map(safeUser)}));
app.post('/admin/users', requireLogin, requireRole('admin'), async (req,res)=>{
  const name=(req.body.name||'').trim(),email=(req.body.email||'').trim().toLowerCase(),password=req.body.password||'',role=req.body.role;
  if(!name||!email||password.length<8||!['staff','customer','admin'].includes(role)||store.users.some(u=>u.email===email)){notice(req,'Thông tin không hợp lệ, email đã tồn tại hoặc mật khẩu dưới 8 ký tự.','danger');return res.redirect('/admin/users');}
  store.users.push({id:store.nextUserId++,name,email,phone:'',address:'',password:await bcrypt.hash(password,10),role,active:true});saveStore();notice(req,'Đã tạo tài khoản.');res.redirect('/admin/users');
});
app.post('/admin/users/:id/toggle', requireLogin, requireRole('admin'), (req,res)=>{
  const user=store.users.find(u=>u.id===Number(req.params.id));if(user&&user.id!==req.session.userId){user.active=!user.active;saveStore();notice(req,user.active?'Đã mở khóa tài khoản.':'Đã khóa tài khoản.');}res.redirect('/admin/users');
});

app.use((req,res)=>res.status(404).render('error',{title:'Không tìm thấy trang',message:'Đường dẫn bạn truy cập không tồn tại.'}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).render('error',{title:'Lỗi máy chủ',message:'Đã xảy ra lỗi. Kiểm tra Terminal để biết chi tiết.'});});
app.listen(PORT,()=>console.log(`STUDIO Fashion đang chạy tại http://localhost:${PORT}`));
