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
  int moves = 0;
  int totalPlayers = 0;
  static int offset = squareSize*2;
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
    try{
    game.tick();
    }catch(java.lang.InterruptedException jkk){}
    moves++;
    if(worldSpeed<=squareSize*2){
      worldSpeed+=0.5;
    }
    if(key == KeyEvent.VK_D || key == KeyEvent.VK_RIGHT){
      changeAll(speed,0);
      if(offsetX>=-(2*squareSize)){
        offsetX-=((int)worldSpeed);
      }
      
      return;
    }
    if(key == KeyEvent.VK_A || key == KeyEvent.VK_LEFT){
      changeAll(-speed,0);
      if(offsetX<=(2*squareSize)){
        offsetX+=((int)worldSpeed);
      }

      return;
    }
    if(key == KeyEvent.VK_S || key == KeyEvent.VK_DOWN){
      changeAll(0,speed);
      if(offsetY>=-(2*squareSize)){
        offsetY-=((int)worldSpeed);
      }

      return;
    }
    if(key == KeyEvent.VK_W || key == KeyEvent.VK_UP){
      changeAll(0,-speed);
      if(offsetY<=(2*squareSize)){
        offsetY+=((int)worldSpeed);
      }

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
    totalPlayers = 0;
    moves = 0;
    worldSpeed = 0;
    offsetX = offset;
    offsetY = offset;
    
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
    players = new ArrayList<Player>();
    enemies = new ArrayList<Enemy>();
    for(int i = 0;i<currentMap.length;i++){
      for(int j = 0;j<currentMap[0].length;j++){
        if(currentMap[i][j].equals("P")){
          players.add(new Player(j,i,this)) ;
          totalPlayers++;
        }
        if(currentMap[i][j].equals("1")){
          enemies.add(new Enemy(j,i,this)) ;
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
    g2d.drawString("LEVEL : " +level +"    MOVES : "+moves, 10, 10);
    
    
    for(int y = 0; y < currentMap.length; y++)
    {
      for(int x = 0; x < currentMap[0].length; x++)
      {
        int jk = (int)(Math.random()*10)+60;
        String val = currentMap[y][x];      
        if(val.equals("#")){
          g2d.setPaint(new Color(jk,jk,jk));
          g2d.fillRect(offsetX+x*squareSize,offsetY+y*squareSize,squareSize,squareSize);
        }else if(val.equals("!")){
          g2d.setPaint(new Color(0,jk+50,0));
          g2d.fillRect(offsetX+x*squareSize, offsetY+y*squareSize, squareSize, squareSize);
        }else if(val.equals("x")){
          g2d.setPaint(new Color(jk+100,jk+10,0));
          g2d.fillRect(offsetX+x*squareSize, offsetY+y*squareSize, squareSize, squareSize);
          //g2d.drawImage((Image)lava,offset+x*squareSize,offset+y*squareSize,null);
        }else if(val.equals(" ") || val.equals("P")){
          g2d.setPaint(new Color(jk/6,jk/6,jk/6));
          g2d.fillRect(offsetX+x*squareSize, offsetY+y*squareSize, squareSize, squareSize);
        }
        else if(isInteger(val)){
          g2d.setPaint(new Color(jk/6,jk/6,jk/6));
          g2d.fillRect(offsetX+x*squareSize, offsetY+y*squareSize, squareSize, squareSize);
          g2d.setPaint(Color.red);
          g2d.fillOval(offsetX+x*squareSize+squareSize/3, offsetY+y*squareSize+squareSize/3, squareSize/4, squareSize/4); 
          //g2d.drawString(val,offset+x*squareSize+squareSize/3,offset+y*squareSize+squareSize/3);
        } 
      }
      
    }
    
    
    for(int i = 0; i < players.size(); i++){
      Point p = players.get(i);
      g2d.setPaint(Color.white);
      g2d.fillRect(offsetX+p.x*squareSize, offsetY+p.y*squareSize, squareSize, squareSize);
      //g2d.drawString("("+p.x+","+p.y+")",offset+p.x*squareSize,offset+p.y*squareSize);
    }
    for(int i = 0; i < enemies.size(); i++){
      int jk = (int)(Math.random()*10)+60;
      Point p = enemies.get(i);
      g2d.setPaint(new Color(jk*3,0,0));
      g2d.fillRect(offsetX+p.x*squareSize, offsetY+p.y*squareSize, squareSize, squareSize);
    }
  }
  public void checkEnemyTouch(){
    for(Player p: players){
      for(Enemy e: enemies){
        if(p.x == e.x && p.y == e.y){
          initialize(); 
        }
      }
    }
  }
  public ArrayList<Player> getPlayers(){
   return players; 
  }
  public String[][] getCurrentMap(){
   return currentMap; 
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
  public int getPlayersDone(){
   return playersDone; 
  }
  public void setPlayersDone(int s){
   playersDone = s;
  }
  public int getLevel(){
    return level;
  }
  public void setLevel(int l){
   level = l; 
  }
  public int getTotalPlayers(){
   return totalPlayers; 
  }
  public ArrayList<Enemy> getEnemies(){
   return enemies; 
  }
  private void tick() throws InterruptedException {
    repaint();
    checkEnemyTouch();
    for(Enemy e: enemies){
     e.tick(); 
    }
  }  
  private void changeAll(int x, int y){
    for(Player p: players){
      p.move(x,y);
    }
  }
  public static void main(String[] args) throws Exception {
    JFrame frame = new JFrame("boi");
    game = new Game();
    game.initialize();
    frame.add(game);
    frame.setSize(squareSize*27+offset, squareSize*18+offset);
    frame.setVisible(true);
    frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
    while(true){
      for(Player p: game.players){
       p.checkEnemyTouch(); 
      }
      Thread.sleep(100);
    }
  }
}