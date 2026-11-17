const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('./user-data.js');

const place = {
  enterprise: '苏州测试工厂',
  name: '东门',
  address: '苏州市工业园区测试路 1 号',
  lat: 31.300001,
  lng: 120.700001,
  coordSystem: 'gcj02'
};

test('Gaode navigation uses intent dispatch on Android so a missing app falls back to the page', () => {
  const uri = U.mapAppUrl('高德地图', place, 'android', 'https://example.com/a?b=1');

  assert.match(uri, /^intent:\/\/route\/plan\/\?/);
  assert.match(uri, /#Intent;scheme=amapuri;package=com\.autonavi\.minimap;/);
  assert.match(uri, /S\.browser_fallback_url=https%3A%2F%2Fexample\.com%2Fa%3Fb%3D1/);
  assert.match(uri, /dlat=31\.300001/);
  assert.match(uri, /dlon=120\.700001/);
});

test('Gaode uses the documented iOS route URI', () => {
  assert.match(U.mapAppUrl('高德地图', place, 'ios'), /^iosamap:\/\/path\?/);
});

test('navigation refuses missing destination coordinates', () => {
  assert.throws(() => U.mapAppUrl('高德地图', {...place, lat: null}), /真实入口位置/);
});

test('Baidu navigation keeps native URI on iOS and uses intent on Android', () => {
  assert.match(U.mapAppUrl('百度地图', place, 'ios'), /^baidumap:\/\/map\/navi\?/);
  const uri = U.mapAppUrl('百度地图', place, 'android');
  assert.match(uri, /^intent:\/\/map\/navi\?/);
  assert.match(uri, /scheme=bdapp;package=com\.baidu\.BaiduMap/);
});

test('providers without a native navigation URI are excluded', () => {
  assert.equal(U.mapAppUrl('腾讯地图', place, 'android'), null);
});

test('Baidu coordinates remain unchanged when already stored in BD09', () => {
  const uri = U.mapAppUrl('百度地图', {...place, lat:31.347826, lng:120.520555, coordSystem:'bd09'}, 'android');
  assert.equal(new URL(uri).searchParams.get('location'), '31.347826,120.520555');
});

test('destination names cannot introduce extra URI parameters', () => {
  const uri = U.mapAppUrl('高德地图', {...place, enterprise:'工厂 &dlat=0#入口'}, 'ios');
  const params = new URL(uri).searchParams;
  assert.equal(params.get('dname'), '工厂 &dlat=0#入口 东门');
  assert.deepEqual(params.getAll('dlat'), ['31.300001']);
});

test('old Tencent default is reset to an available provider choice', () => {
  assert.equal(U.normalize({places:[], settings:{mapProvider:'腾讯地图'}}).settings.mapProvider, '每次询问');
});

test('导入备份只接受结构完整的场所数据', () => {
  const ok = U.sanitizeImport({places: [{id: 'p1', enterprise: '甲公司', name: '东门', address: '某路 1 号'}], route: ['p1', 'missing']});
  assert.equal(ok.places.length, 1);
  assert.deepEqual(ok.route, ['p1']);
  assert.throws(() => U.sanitizeImport({places: []}), /没有任何场所记录/);
  assert.throws(() => U.sanitizeImport({places: [{enterprise: '甲公司'}]}), /缺少企业、场所或地址/);
});
