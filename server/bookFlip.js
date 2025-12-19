let scene, camera, renderer, pages = [];

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(45, 1000 / 1416, 1, 5000);
camera.position.z = 1800;

renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(1000, 1416);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 2000);
scene.add(light);

window.loadPages = (images) => {
  images.forEach((src, i) => {
    const tex = new THREE.TextureLoader().load(src);
    const geo = new THREE.PlaneGeometry(1000, 1416, 30, 1);
    const mat = new THREE.MeshPhongMaterial({ map: tex, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = i * 5;
    scene.add(mesh);
    pages.push(mesh);
  });
};

window.render = (t) => {
  pages.forEach((p, i) => {
    if (i === 0) {
      p.rotation.y = -Math.PI * t;
    }
  });
  renderer.render(scene, camera);
};
