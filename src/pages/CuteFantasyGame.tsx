import { ArrowLeft, Heart, Shield, Sparkles, Sword } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type Direction = "up" | "down" | "left" | "right";

interface Controls {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  interact: boolean;
}

const initialControls: Controls = { up: false, down: false, left: false, right: false, attack: false, interact: false };
const asset = (path: string) => `/cute-fantasy/${path}`;

export default function CuteFantasyGame() {
  const navigate = useNavigate();
  const gameHost = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const controls = useRef<Controls>({ ...initialControls });
  const [health, setHealth] = useState(5);
  const [coins, setCoins] = useState(0);
  const [message, setMessage] = useState("Encontre o baú antigo");

  useEffect(() => {
    if (!gameHost.current) return;
    let active = true;

    void import("phaser").then(({ default: Phaser }) => {
      if (!active || !gameHost.current) return;

      class FantasyScene extends Phaser.Scene {
        player!: any;
        cursors!: any;
        wasd!: Record<string, any>;
        chest!: any;
        enemies!: any;
        animals!: any;
        lastHit = 0;
        facing: Direction = "down";
        chestOpened = false;

        constructor() { super("cute-fantasy"); }

        preload() {
          this.load.spritesheet("player", asset("Player/Player.png"), { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet("skeleton", asset("Enemies/Skeleton.png"), { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet("slime", asset("Enemies/Slime_Green.png"), { frameWidth: 32, frameHeight: 32 });
          this.load.spritesheet("chicken", asset("Animals/Chicken/Chicken.png"), { frameWidth: 16, frameHeight: 16 });
          this.load.spritesheet("cow", asset("Animals/Cow/Cow.png"), { frameWidth: 16, frameHeight: 16 });
          this.load.spritesheet("pig", asset("Animals/Pig/Pig.png"), { frameWidth: 16, frameHeight: 16 });
          this.load.spritesheet("sheep", asset("Animals/Sheep/Sheep.png"), { frameWidth: 16, frameHeight: 16 });
          this.load.image("grass", asset("Tiles/Grass_Middle.png"));
          this.load.image("water", asset("Tiles/Water_Middle.png"));
          this.load.image("path", asset("Tiles/Path_Middle.png"));
          this.load.image("farmland", asset("Tiles/FarmLand_Tile.png"));
          this.load.spritesheet("decor", asset("outdoor-decoration/Outdoor_Decor_Free.png"), { frameWidth: 16, frameHeight: 16 });
          this.load.image("house", asset("outdoor-decoration/House_1_Wood_Base_Blue.png"));
          this.load.image("tree", asset("outdoor-decoration/Oak_Tree.png"));
          this.load.image("tree-small", asset("outdoor-decoration/Oak_Tree_Small.png"));
          this.load.image("bridge-sheet", asset("outdoor-decoration/Bridge_Wood.png"));
          this.load.image("chest", asset("outdoor-decoration/Chest.png"));
        }

        create() {
          this.physics.world.setBounds(0, 0, 640, 960);
          this.add.tileSprite(320, 480, 640, 960, "grass").setDepth(0);
          this.add.tileSprite(326, 480, 64, 960, "water").setDepth(1);
          this.add.tileSprite(142, 435, 284, 48, "path").setDepth(2);
          this.add.tileSprite(504, 435, 272, 48, "path").setDepth(2);
          this.add.tileSprite(198, 650, 144, 112, "farmland").setDepth(2);
          this.add.image(326, 435, "bridge-sheet").setCrop(48, 30, 48, 30).setDisplaySize(74, 42).setDepth(5);

          const decorFrames = [0, 1, 2, 7, 8, 14, 15, 16, 56, 57, 63, 64, 70, 71];
          for (let index = 0; index < 150; index += 1) {
            const x = 18 + ((index * 83) % 604);
            const y = 28 + ((index * 137) % 900);
            const isRiver = x > 284 && x < 368;
            const isPath = y > 400 && y < 470;
            const isHouse = x > 145 && x < 305 && y > 235 && y < 410;
            const isFarm = x > 145 && x < 315 && y > 585 && y < 720;
            if (!isRiver && !isPath && !isHouse && !isFarm) this.add.sprite(x, y, "decor", decorFrames[index % decorFrames.length]).setDepth(3).setAlpha(index % 4 ? 0.82 : 1);
          }

          this.add.image(225, 325, "house").setScale(1.25).setDepth(325);
          const largeTrees = [[68, 245], [270, 310], [76, 530], [555, 165], [78, 810], [548, 790], [505, 900]];
          const smallTrees = [[250, 470], [425, 245], [210, 760], [445, 680]];
          largeTrees.forEach(([x, y]) => this.add.image(x, y, "tree").setDepth(y));
          smallTrees.forEach(([x, y]) => this.add.image(x, y, "tree-small").setDepth(y));

          const blockers: any[] = [];
          const addBlocker = (x: number, y: number, width: number, height: number) => {
            const zone = this.add.zone(x, y, width, height);
            this.physics.add.existing(zone, true);
            blockers.push(zone);
          };
          addBlocker(326, 200, 64, 400);
          addBlocker(326, 714, 64, 492);
          addBlocker(225, 360, 118, 62);
          largeTrees.forEach(([x, y]) => addBlocker(x, y + 20, 18, 18));
          smallTrees.forEach(([x, y]) => addBlocker(x, y + 12, 14, 14));

          this.anims.create({ key: "walk-down", frames: this.anims.generateFrameNumbers("player", { start: 0, end: 5 }), frameRate: 9, repeat: -1 });
          this.anims.create({ key: "walk-side", frames: this.anims.generateFrameNumbers("player", { start: 6, end: 11 }), frameRate: 9, repeat: -1 });
          this.anims.create({ key: "walk-up", frames: this.anims.generateFrameNumbers("player", { start: 12, end: 17 }), frameRate: 9, repeat: -1 });
          this.anims.create({ key: "skeleton-walk", frames: this.anims.generateFrameNumbers("skeleton", { start: 0, end: 5 }), frameRate: 7, repeat: -1 });
          this.anims.create({ key: "slime-bounce", frames: this.anims.generateFrameNumbers("slime", { start: 0, end: 7 }), frameRate: 7, repeat: -1 });

          this.player = this.physics.add.sprite(285, 520, "player", 0).setDepth(520).setCollideWorldBounds(true);
          this.player.body.setSize(16, 14).setOffset(8, 17);
          blockers.forEach((blocker) => this.physics.add.collider(this.player, blocker));
          this.cameras.main.setBounds(0, 0, 640, 960).startFollow(this.player, true, 0.11, 0.11).setZoom(1.6);
          this.cameras.main.setBackgroundColor("#75a84c");

          this.chest = this.physics.add.staticImage(485, 335, "chest").setScale(1.35).setDepth(335);
          this.chest.refreshBody();
          this.physics.add.collider(this.player, this.chest);
          this.enemies = this.physics.add.group();
          this.spawnEnemy(470, 540, "skeleton");
          this.spawnEnemy(205, 820, "slime");

          this.animals = this.physics.add.group({ allowGravity: false });
          this.addAnimal(155, 515, "chicken", 0);
          this.addAnimal(215, 555, "pig", 1);
          this.addAnimal(455, 735, "cow", 0);
          this.addAnimal(535, 700, "sheep", 2);
          this.physics.add.collider(this.player, this.animals);
          this.physics.add.collider(this.animals, this.animals);
          blockers.forEach((blocker) => this.physics.add.collider(this.animals, blocker));

          this.physics.add.overlap(this.player, this.enemies, (_player, enemy: any) => this.hurtPlayer(enemy));
          this.cursors = this.input.keyboard?.createCursorKeys();
          this.wasd = this.input.keyboard?.addKeys("W,A,S,D,SPACE,E") as Record<string, any>;
          this.input.keyboard?.on("keydown-SPACE", () => this.attack());
          this.input.keyboard?.on("keydown-E", () => this.interact());
        }

        addAnimal(x: number, y: number, key: string, frame: number) {
          const animal = this.animals.create(x, y, key, frame).setScale(2).setDepth(y).setCollideWorldBounds(true);
          animal.body.setSize(12, 10).setOffset(2, 5);
          animal.setData({ homeX: x, homeY: y, nextTurn: 0 });
        }

        spawnEnemy(x: number, y: number, key: string) {
          const enemy = this.enemies.create(x, y, key, 0).setDepth(y).setData("hp", 2);
          enemy.body.setSize(18, 16).setOffset(7, 16);
          enemy.play(key === "slime" ? "slime-bounce" : "skeleton-walk");
          this.tweens.add({ targets: enemy, x: x + 75, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.inOut", onYoyo: () => enemy.setFlipX(true), onRepeat: () => enemy.setFlipX(false) });
        }

        hurtPlayer(enemy: any) {
          if (this.time.now - this.lastHit < 900) return;
          this.lastHit = this.time.now;
          setHealth((value) => Math.max(0, value - 1));
          setMessage("Cuidado com os monstros!");
          this.player.setTint(0xff6b6b);
          this.player.body.velocity.x += this.player.x < enemy.x ? -130 : 130;
          this.time.delayedCall(180, () => this.player.clearTint());
          this.cameras.main.shake(120, 0.008);
        }

        attack() {
          const reachX = this.facing === "left" ? -34 : this.facing === "right" ? 34 : 0;
          const reachY = this.facing === "up" ? -34 : this.facing === "down" ? 34 : 0;
          const slash = this.add.circle(this.player.x + reachX, this.player.y + reachY, 19, 0xffe38b, 0.7).setDepth(2000);
          this.tweens.add({ targets: slash, alpha: 0, scale: 1.6, duration: 180, onComplete: () => slash.destroy() });
          this.enemies.getChildren().forEach((enemy: any) => {
            if (!enemy.active || Phaser.Math.Distance.Between(this.player.x + reachX, this.player.y + reachY, enemy.x, enemy.y) > 34) return;
            const hp = enemy.getData("hp") - 1;
            enemy.setData("hp", hp).setTint(0xffd56b);
            if (hp <= 0) {
              enemy.destroy();
              setCoins((value) => value + 3);
              setMessage("Monstro derrotado: +3 moedas");
            } else this.time.delayedCall(140, () => enemy.clearTint());
          });
        }

        interact() {
          if (this.chestOpened || Phaser.Math.Distance.Between(this.player.x, this.player.y, this.chest.x, this.chest.y) > 52) {
            setMessage("Chegue perto do baú para abri-lo");
            return;
          }
          this.chestOpened = true;
          this.chest.setTint(0xffdc73);
          setCoins((value) => value + 10);
          setMessage("Tesouro encontrado: +10 moedas!");
          const glow = this.add.circle(this.chest.x, this.chest.y, 12, 0xffef88, 0.9).setDepth(1000);
          this.tweens.add({ targets: glow, scale: 4, alpha: 0, duration: 700, onComplete: () => glow.destroy() });
        }

        update() {
          const keyboard = {
            left: this.cursors?.left.isDown || this.wasd?.A.isDown,
            right: this.cursors?.right.isDown || this.wasd?.D.isDown,
            up: this.cursors?.up.isDown || this.wasd?.W.isDown,
            down: this.cursors?.down.isDown || this.wasd?.S.isDown,
          };
          const input = controls.current;
          const left = input.left || keyboard.left;
          const right = input.right || keyboard.right;
          const up = input.up || keyboard.up;
          const down = input.down || keyboard.down;
          const velocity = 92;
          this.player.setVelocity(0);
          if (left) { this.player.setVelocityX(-velocity); this.facing = "left"; this.player.setFlipX(true).play("walk-side", true); }
          else if (right) { this.player.setVelocityX(velocity); this.facing = "right"; this.player.setFlipX(false).play("walk-side", true); }
          if (up) { this.player.setVelocityY(-velocity); this.facing = "up"; this.player.setFlipX(false).play("walk-up", true); }
          else if (down) { this.player.setVelocityY(velocity); this.facing = "down"; this.player.setFlipX(false).play("walk-down", true); }
          if ((left || right) && (up || down)) this.player.body.velocity.normalize().scale(velocity);
          if (!left && !right && !up && !down) this.player.stop();
          this.player.setDepth(this.player.y);
          this.animals.getChildren().forEach((animal: any) => {
            const homeX = animal.getData("homeX");
            const homeY = animal.getData("homeY");
            if (this.time.now >= animal.getData("nextTurn")) {
              const distance = Phaser.Math.Distance.Between(animal.x, animal.y, homeX, homeY);
              if (distance > 38) this.physics.moveTo(animal, homeX, homeY, 18);
              else animal.setVelocity(Phaser.Math.Between(-18, 18), Phaser.Math.Between(-12, 12));
              animal.setData("nextTurn", this.time.now + Phaser.Math.Between(900, 1800));
            }
            animal.setFlipX(animal.body.velocity.x < 0);
            animal.setDepth(animal.y);
          });
          if (input.attack) { input.attack = false; this.attack(); }
          if (input.interact) { input.interact = false; this.interact(); }
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: gameHost.current,
        width: 360,
        height: 640,
        pixelArt: true,
        backgroundColor: "#75a84c",
        physics: { default: "arcade", arcade: { debug: false } },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: FantasyScene,
      });
    });

    return () => {
      active = false;
      controls.current = { ...initialControls };
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const setDirection = (direction: Direction, pressed: boolean) => { controls.current[direction] = pressed; };
  const action = (key: "attack" | "interact") => { controls.current[key] = true; };

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#17251b] text-white [touch-action:none]">
      <div ref={gameHost} className="absolute inset-0 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full [&_canvas]:object-contain" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-[430px] items-start justify-between p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button onClick={() => navigate("/")} className="pointer-events-auto grid size-11 place-items-center rounded-md border-2 border-[#efd57b] bg-[#183b2b]/90 shadow-[0_3px_0_#0b2118]" title="Voltar"><ArrowLeft size={22} /></button>
        <div className="flex gap-2">
          <div className="flex h-11 items-center gap-1.5 rounded-md border-2 border-[#efd57b] bg-[#183b2b]/90 px-3 font-black"><Heart className="fill-[#e85252] text-[#e85252]" size={18} />{health}</div>
          <div className="flex h-11 items-center gap-1.5 rounded-md border-2 border-[#efd57b] bg-[#183b2b]/90 px-3 font-black"><Sparkles className="text-[#ffd75a]" size={18} />{coins}</div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 top-[72px] z-20 mx-auto w-[min(86%,340px)] rounded-md border border-[#efd57b]/70 bg-[#10251d]/88 px-3 py-2 text-center text-xs font-bold shadow-lg">{message}</div>

      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[430px] items-end justify-between p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 grid-rows-3 gap-1">
          <span /><ControlButton label="↑" onChange={(pressed) => setDirection("up", pressed)} /><span />
          <ControlButton label="←" onChange={(pressed) => setDirection("left", pressed)} /><span className="size-14 rounded-md border border-white/10 bg-black/20" /><ControlButton label="→" onChange={(pressed) => setDirection("right", pressed)} />
          <span /><ControlButton label="↓" onChange={(pressed) => setDirection("down", pressed)} /><span />
        </div>
        <div className="flex items-end gap-3">
          <button onPointerDown={(event) => { event.preventDefault(); action("interact"); }} className="grid size-14 place-items-center rounded-full border-[3px] border-[#f3d889] bg-[#316c4d] shadow-[0_5px_0_#173d2a] active:translate-y-1 active:shadow-none" title="Interagir"><Shield size={25} /></button>
          <button onPointerDown={(event) => { event.preventDefault(); action("attack"); }} className="grid size-[72px] place-items-center rounded-full border-[4px] border-[#ffe49a] bg-[#b94b3f] shadow-[0_6px_0_#702a25] active:translate-y-1 active:shadow-none" title="Atacar"><Sword size={34} /></button>
        </div>
      </div>
    </main>
  );
}

function ControlButton({ label, onChange }: { label: string; onChange: (pressed: boolean) => void }) {
  return <button
    onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onChange(true); }}
    onPointerUp={() => onChange(false)}
    onPointerCancel={() => onChange(false)}
    onLostPointerCapture={() => onChange(false)}
    className="grid size-14 place-items-center rounded-md border-2 border-[#e5d18c] bg-[#193d2d]/92 text-2xl font-black shadow-[0_4px_0_#0a2217] active:translate-y-1 active:shadow-none"
  >{label}</button>;
}
