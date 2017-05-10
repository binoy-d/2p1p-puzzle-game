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
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.io.File;
import java.awt.MouseInfo;
import java.io.FileNotFoundException;
import java.awt.Image;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.IOException;

public class Game extends JPanel implements KeyListener,MouseListener{
  int level = 0;
  static int squareSize = 32;
  static int offset = squareSize*2;
  int speed = 1;
  String[][] currentMap = new String[1][1];
  ArrayList<Point> players = new ArrayList<Point>();
  ArrayList<Point> enemies = new ArrayList<Point>();
  BufferedImage wall = null;
  BufferedImage lava = null;
  /*
   * LEVEL DESIGN CODE:
   * # = wall
   *  = empty
   * P =player
   * 1-9 = enemy(start @ 1, go to 9)
   * x = lava
   * */
  int playersDone = 0;
  
  public void keyPressed(KeyEvent e) {
    int key = e.getKeyCode();
    if(key == KeyEvent.VK_D){
      changeAll(speed,0);
      enemyTick();
      return;
    }
    if(key == KeyEvent.VK_A){
      changeAll(-speed,0);
      enemyTick();
      return;
    }
    if(key == KeyEvent.VK_S){
      changeAll(0,speed);
      enemyTick();
      return;
    }
    if(key == KeyEvent.VK_W){
      changeAll(0,-speed);
      enemyTick();
      return;
    }
  }
  
  public void keyReleased(KeyEvent e) {}
  public void keyTyped(KeyEvent e) {}
  
  public Game(){
    addKeyListener(this);
    setFocusable(true);
    setFocusTraversalKeysEnabled(false);
  }
  
  public void initialize() {
    
    try {
      wall = ImageIO.read(new File("./images/wall.png"));
      lava = ImageIO.read(new File("./images/lava.png"));
    } catch (IOException e) {
    }
    try {
      
      lava = ImageIO.read(new File("./images/lava.png"));
    } catch (IOException e) {
    }
    playersDone = 0;
    try{
      Scanner s = new Scanner(new File("./maps/map"+level));
      ArrayList<String> list = new ArrayList<String>();
      while (s.hasNextLine()){
        list.add(s.nextLine());
      }
      currentMap = new String[list.size()][list.get(0).length()];
      for(int r = 0;r<list.size();r++){
        for(int c = 0;c<list.get(0).length();c++){
          String kkk = list.get(r).substring(c,c+1);
          currentMap[r][c] = kkk;
        }
      }
      s.close();
    }catch(FileNotFoundException e){
      System.out.println("Map not found");
    }
    players = new ArrayList<Point>();
    enemies = new ArrayList<Point>();
    for(int i = 0;i<currentMap.length;i++){
      for(int j = 0;j<currentMap[0].length;j++){
        if(currentMap[i][j].equals("P")){
          players.add(new Point(j,i)) ;
        }
        if(currentMap[i][j].equals("1")){
          enemies.add(new Point(j,i)) ;
        }
      }
    }
  }
  
  public void mouseExited(MouseEvent e){}
  public void mousePressed(MouseEvent e){
  }
  public void mouseEntered(MouseEvent e){}
  public void mouseReleased(MouseEvent e){}
  public void mouseClicked(MouseEvent e){
  }
  
  public void paint(Graphics g)
  {
    
    super.paint(g);
    Graphics2D g2d = (Graphics2D) g;
    g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                         RenderingHints.VALUE_ANTIALIAS_ON);
    setBackground(Color.black);
    g2d.setPaint(Color.white);
    g2d.drawString("LEVEL: " +level , 10, 10);
    for(int y = 0; y < currentMap.length; y++)
    {
      for(int x = 0; x < currentMap[0].length; x++)
      {
        String val = currentMap[y][x];
        if(val.equals("#")){
          try {
            wall = ImageIO.read(new File("./images/wall"+((int)(Math.random()*3))+".png"));
          } catch (IOException e) {
          }
          
          
          g2d.setPaint(Color.gray);
          //g2d.fillRect(offset+x*squareSize, offset+y*squareSize, squareSize, squareSize);
          g2d.drawImage((Image)wall,offset+x*squareSize,offset+y*squareSize,null);
        }else if(val.equals("!")){
          g2d.setPaint(Color.green);
          g2d.fillRect(offset+x*squareSize, offset+y*squareSize, squareSize, squareSize);
        }else if(val.equals("x")){
          g2d.setPaint(Color.orange);
          //g2d.fillRect(offset+x*squareSize, offset+y*squareSize, squareSize, squareSize);
          g2d.drawImage((Image)lava,offset+x*squareSize,offset+y*squareSize,null);
        }else if(val.equals(" ")){
          g2d.setPaint(Color.black);
          g2d.fillRect(offset+x*squareSize, offset+y*squareSize, squareSize, squareSize);
        }
        else if(isInteger(val)){
          g2d.setPaint(Color.red);
          g2d.fillOval(offset+x*squareSize+squareSize/3, offset+y*squareSize+squareSize/3, squareSize/4, squareSize/4); 
          //g2d.drawString(val,offset+x*squareSize+squareSize/3,offset+y*squareSize+squareSize/3);
        } 
      }
    }
    for(int i = 0; i < players.size(); i++){
      Point p = players.get(i);
      g2d.setPaint(Color.white);
      g2d.fillRect(offset+p.x*squareSize, offset+p.y*squareSize, squareSize, squareSize);
      //g2d.drawString("("+p.x+","+p.y+")",offset+p.x*squareSize,offset+p.y*squareSize);
    }
    for(int i = 0; i < enemies.size(); i++){
      Point p = enemies.get(i);
      g2d.setPaint(Color.red);
      g2d.fillRect(offset+p.x*squareSize, offset+p.y*squareSize, squareSize, squareSize);
    }
  }
  public void enemyTick(){
    for(Point e: enemies){   
      for(Point p: players){
        if(p.x == e.x &&p.y == e.y){
          initialize(); 
        }
      }
      boolean moved = false;
      int currentVal = Integer.parseInt(currentMap[e.y][e.x]);
      for(int r= e.y-1;r<=e.y+1&&moved == false;r++){
        for(int c= e.x-1;c<=e.x+1;c++){
          int newVal = 0;
          if(isInteger(currentMap[r][c]))
            newVal = Integer.parseInt(currentMap[r][c]);
          if(newVal-1==currentVal){
            currentMap[e.y][e.x] = ""+(18-currentVal);
            e.x = c;
            e.y = r;
            moved = true;
          }
          if(currentVal == 17){
            currentVal = 1;
          }
        }
      }
    }
  }
  public void checkEnemyTouch(){
    for(Point p: players){
      for(Point e: enemies){
        if(p.x == e.x && p.y == e.y){
          initialize(); 
        }
      }
    }
  }
  public static boolean isInteger(String s) {
    try { 
      Integer.parseInt(s); 
    } catch(NumberFormatException e) { 
      return false; 
    } catch(NullPointerException e) {
      return false;
    }
    // only got here if we didn't return false
    return true;
  }
  private void tick() throws InterruptedException {
    repaint();
    checkEnemyTouch();
    Thread.sleep(200);
  }  
  private void changeAll(int x, int y){
    for(int i = 0; i < players.size(); i++){
      Point p = players.get(i);
      
      try{
        String val = currentMap[p.y+y][p.x+x];
        if((" P 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18").indexOf(val) != -1){//I die a little every time
          p.x += x;
          p.y += y;
          
        }
        else if(val.equals("!")){
          playersDone++;
          players.remove(players.indexOf(p));
          if(playersDone >= 2){
            level++;
            initialize();
          }
        }
        else if(val.equals("x")){
          initialize(); 
        }
        for(Point e:enemies){
          if(p.x == e.x && e.y == p.y)
            initialize();
        }
      }
      catch(ArrayIndexOutOfBoundsException e){
        players.remove(p);
      }
    }
  }
  
  public static void main(String[] args) throws Exception {
    JFrame frame = new JFrame("boi");
    Game game = new Game();
    
    game.initialize();
    frame.add(game);
    frame.setSize(squareSize*27+offset, squareSize*18+offset);
    frame.setVisible(true);
    frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
    while (true)
    {
      game.tick();
    }
  }
  
}