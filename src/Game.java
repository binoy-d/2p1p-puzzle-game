import java.awt.Color;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.RenderingHints;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import javax.swing.JFrame;
import javax.swing.JPanel;
import java.awt.event.KeyListener;
import java.util.Scanner;
import java.io.File;
import java.awt.MouseInfo;
import java.io.FileNotFoundException;
import java.awt.Image;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.IOException;

public class Game extends JPanel implements KeyListener {
 int playerSize = 20;
 int playerState = 0;
 int level = 0;
 int where = 0;
 static int squareSize = 64;
 int moves = 0;
 int totalPlayers = 0;
 static int offset = squareSize * 2;
 int speed = 1;
 String[][] currentMap = new String[1][1];
 ArrayList<Player> players = new ArrayList<Player>();
 ArrayList<Enemy> enemies = new ArrayList<Enemy>();
 double worldSpeed = 0;
 int wallNum = 0;
 BufferedImage wall = null;
 BufferedImage lava = null;
 int offsetX = offset;
 int offsetY = offset;
 static Game game;
 /*
  * LEVEL DESIGN CODE: # = wall = empty P =player 1-9 = enemy(start @ 1, go to 9)
  * x = lava
  */
 int playersDone = 0;

 public void keyPressed(KeyEvent e) {
  int key = e.getKeyCode();

  moves++;
  if (worldSpeed <= squareSize * 2) {
   worldSpeed += 0.5;
  }
  if (key == KeyEvent.VK_D || key == KeyEvent.VK_RIGHT) {
   try {
    where = 1;
    game.tick();
   } catch (java.lang.InterruptedException jkk) {
   }
   changeAll(speed, 0);

   if (offsetX >= -(2 * squareSize)) {
    offsetX -= ((int) worldSpeed);
   }

   return;
  }
  if (key == KeyEvent.VK_A || key == KeyEvent.VK_LEFT) {
   try {
    where = 1;
    game.tick();
   } catch (java.lang.InterruptedException jkk) {
   }
   changeAll(-speed, 0);
   if (offsetX <= (2 * squareSize)) {
    offsetX += ((int) worldSpeed);
   }

   return;
  }
  if (key == KeyEvent.VK_S || key == KeyEvent.VK_DOWN) {
   try {
    where = 1;
    game.tick();
   } catch (java.lang.InterruptedException jkk) {
   }
   changeAll(0, speed);
   if (offsetY >= -(2 * squareSize)) {
    offsetY -= ((int) worldSpeed);
   }

   return;
  }
  if (key == KeyEvent.VK_W || key == KeyEvent.VK_UP) {
   try {
    where = 1;
    game.tick();
   } catch (java.lang.InterruptedException jkk) {
   }
   changeAll(0, -speed);
   if (offsetY <= (2 * squareSize)) {
    offsetY += ((int) worldSpeed);
   }

   return;
  }
  if (key == KeyEvent.VK_ESCAPE || key == KeyEvent.VK_P) {
   System.exit(0);
   return;
  }
 }

 public void keyReleased(KeyEvent e) {
 }

 public void keyTyped(KeyEvent e) {
 }

 public Game() {
  addKeyListener(this);
  setFocusable(true);
  setFocusTraversalKeysEnabled(false);
 }

 public void initialize() {
  totalPlayers = 0;
  moves = 0;
  worldSpeed = 0;
  offsetX = offset;
  offsetY = offset;

  playersDone = 0;
    Scanner s = new Scanner(getClass().getResourceAsStream("/maps/map"+level));
    ArrayList<String> list = new ArrayList<String>();
    while (s.hasNextLine()) {
     list.add(s.nextLine());
    }
    currentMap = new String[list.size()][list.get(0).length()];
    for (int r = 0; r < list.size(); r++) {
     for (int c = 0; c < list.get(0).length(); c++) {
      String kkk = list.get(r).substring(c, c + 1);
      currentMap[r][c] = kkk;
     }
    }
    s.close();
  
  players = new ArrayList<Player>();
  enemies = new ArrayList<Enemy>();
  for (int i = 0; i < currentMap.length; i++) {
   for (int j = 0; j < currentMap[0].length; j++) {
    if (currentMap[i][j].equals("P")) {
     players.add(new Player(j, i, this));
     totalPlayers++;
    }
    if (currentMap[i][j].equals("1")) {
     enemies.add(new Enemy(j, i, this));
    }
   }
  }
 }

 public void paint(Graphics g) {

  super.paint(g);
  Graphics2D g2d = (Graphics2D) g;
  g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
  setBackground(Color.black);
  g2d.setPaint(Color.white);
  g2d.drawString(
    "PRESS ESCAPE TO CLOSE                                      LEVEL : " + level + "    MOVES : " + moves,
    10, 10);

  offsetX = ((getParent().getWidth()) - (squareSize * currentMap[0].length)) / 2;
  offsetY = ((getParent().getHeight()) - (squareSize * currentMap.length)) / 2;
  for (int y = 0; y < currentMap.length; y++) {
   for (int x = 0; x < currentMap[0].length; x++) {
    int jk = (int) (Math.random() * 10) + 60;
    String val = currentMap[y][x];
    double bright = getBrightness(x, y);
    int swop = 255 - (int) (bright * 6);
    swop /= 10;
    if (swop <= 30) {
     swop -= 5;
    } else if (swop <= 15) {
     swop -= 10;
    }
    swop *= 2;
    if (swop >= 255) {
     swop = 255;
    }
    if (swop <= 0) {
     swop = 0;
    }
    if (val.equals("#")) {

     g2d.setPaint(new Color(swop * 2, swop * 2, swop * 2));
     g2d.fillRect(offsetX + x * squareSize, offsetY + y * squareSize, squareSize, squareSize);
    } else if (val.equals("!")) {
     g2d.setPaint(new Color(0, 170 + jk, 0));
     g2d.fillRect(offsetX + x * squareSize, offsetY + y * squareSize, squareSize, squareSize);
     g2d.setPaint(new Color(0, 250, 0));
     g2d.fillRect(offsetX + x * squareSize + (squareSize / 4),
       offsetY + y * squareSize + (squareSize / 4), squareSize / 2, squareSize / 2);

    } else if (val.equals("x")) {
     g2d.setPaint(new Color(jk + 100, jk + 10, 0));
     g2d.fillRect(offsetX + x * squareSize, offsetY + y * squareSize, squareSize, squareSize);
     for (int i = 0; i < 4; i++) {
      for (int j = 0; j < 4; j++) {
       jk = (int) (Math.random() * 40) + 30;
       g2d.setPaint(new Color(jk + 180, jk + 10, 0));
       g2d.fillRect(offsetX + x * squareSize + (i * squareSize / 4),
         offsetY + y * squareSize + (j * squareSize / 4), squareSize / 4, squareSize / 4);
      }
     }
    } else if (val.equals(" ") || val.equals("P")) {
     g2d.setPaint(new Color(swop / 4, swop / 4, swop / 4));
     g2d.fillRect(offsetX + x * squareSize, offsetY + y * squareSize, squareSize, squareSize);
    } else if (isInteger(val)) {
     g2d.setPaint(new Color(swop / 4, swop / 4, swop / 4));
     g2d.fillRect(offsetX + x * squareSize, offsetY + y * squareSize, squareSize, squareSize);
     g2d.setPaint(Color.red);
     g2d.fillRect(offsetX + x * squareSize + squareSize / 3, offsetY + y * squareSize + squareSize / 3,
       squareSize / 4, squareSize / 4);
     // g2d.drawString(val,offset+x*squareSize+squareSize/3,offset+y*squareSize+squareSize/3);
    }
   }

  }
  if (where == 0) {
   if (playerState == 0) {
    playerState = 1;
   } else {
    playerState = 0;
   }
  }
  for (int i = 0; i < players.size(); i++) {

   Point p = players.get(i);

   g2d.setPaint(Color.white);

   if (playerState == 0)
    g2d.fillRect(offsetX + p.x * squareSize, offsetY + p.y * squareSize, squareSize, squareSize);
   else
    g2d.fillRect(offsetX + p.x * squareSize + (squareSize - playerSize) / 2,
      offsetY + p.y * squareSize + (squareSize - playerSize) / 2, playerSize, playerSize);
  }

  for (int i = 0; i < enemies.size(); i++) {
   int jk = (int) (Math.random() * 10) + 60;
   Point p = enemies.get(i);
   g2d.setPaint(new Color(200, 0, 0));
   g2d.fillRect(offsetX + p.x * squareSize, offsetY + p.y * squareSize, squareSize, squareSize);
   g2d.setPaint(new Color(250, 0, 0));
   g2d.fillRect(offsetX + p.x * squareSize + (squareSize / 4), offsetY + p.y * squareSize + (squareSize / 4),
     squareSize / 2, squareSize / 2);
  }
 }

 public void checkEnemyTouch() {
  for (Player p : players) {
   for (Enemy e : enemies) {
    if (p.x == e.x && p.y == e.y) {
     initialize();
    }
   }
  }
 }

 public double getBrightness(int x, int y) {
  double sum = 0;
  for (Player p : players) {
   sum += Math.sqrt((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y));
  }
  // System.out.println(sum);
  return sum / (((double) (players.size() + 1)) / 2);
 }

 public ArrayList<Player> getPlayers() {
  return players;
 }

 public String[][] getCurrentMap() {
  return currentMap;
 }

 public static boolean isInteger(String s) {
  try {
   Integer.parseInt(s);
  } catch (NumberFormatException e) {
   return false;
  } catch (NullPointerException e) {
   return false;
  }
  // only got here if we didn't return false
  return true;
 }

 public int getPlayersDone() {
  return playersDone;
 }

 public void setPlayersDone(int s) {
  playersDone = s;
 }

 public int getLevel() {
  return level;
 }

 public void setLevel(int l) {
  level = l;
 }

 public int getTotalPlayers() {
  return totalPlayers;
 }

 public ArrayList<Enemy> getEnemies() {
  return enemies;
 }

 public void tick() throws InterruptedException {
  repaint();
  checkEnemyTouch();
  if (where == 1) {
   for (Enemy e : enemies) {
    e.tick();
    checkEnemyTouch();
   }
  }
  checkEnemyTouch();
 }

 private void changeAll(int x, int y) {
  for (Player p : players) {
   p.move(x, y);
  }
 }

 public static void main(String[] args) throws Exception {

  JFrame frame = new JFrame("A E S T H E T I C S");
  game = new Game();
  game.initialize();
  AudioPlayerExample1 musac = new AudioPlayerExample1(game);
  frame.add(game);
  frame.setExtendedState(JFrame.MAXIMIZED_BOTH);
  frame.setUndecorated(true);
  frame.setVisible(true);
  frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
  musac.play("/musac.wav");

 }
}
