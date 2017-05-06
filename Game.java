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

public class Game extends JPanel implements KeyListener{
  int level = 0;
  static int squareSize = 20;
  static int offset = 20;
  int speed = 1;
  int[][] currentMap = new int[1][1];
  ArrayList<Point> players = new ArrayList<Point>();
  int[][][] levels = {
    {//level 0
      {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,7,0,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,0,0,0,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,0,7,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,0,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1},
      {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
    }
  };
 
  public void keyPressed(KeyEvent e) {
    int key = e.getKeyCode();
    if(key == KeyEvent.VK_D){
      changeAll(speed,0);
      return;
    }
    if(key == KeyEvent.VK_A){
      changeAll(-speed,0);
      return;
    }
    if(key == KeyEvent.VK_S){
      changeAll(0,speed);
      return;
    }
    if(key == KeyEvent.VK_W){
      changeAll(0,-speed);
      return;
    }
  }
 
  public void keyReleased(KeyEvent e) {}
  public void keyTyped(KeyEvent e) {}
 
  public void initialize(){
    currentMap = levels[level];
    for(int i = 0;i<currentMap.length;i++){
      for(int j = 0;j<currentMap[0].length;j++){
        if(currentMap[i][j] == 7){
          players.add(new Point(j,i)) ;
        }
      }
    }
    addKeyListener(this);
    setFocusable(true);
    setFocusTraversalKeysEnabled(false);
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
        int val = currentMap[y][x];
        if(val == 1)
        {
          g2d.setPaint(Color.white);
        }
        else if(val == 2)
        {
          g2d.setPaint(Color.blue);
        }
        else if(val ==0 || val == 7)
        {
          g2d.setPaint(Color.black);
        }
        else
        {
          System.out.println("Array has problems!!!");
        }
        g2d.fillRect(offset+x*squareSize, offset+y*squareSize, squareSize, squareSize);
      }
    }
    for(int i = 0; i < players.size(); i++)
    {
      Point p = players.get(i);
      g2d.setPaint(Color.green);
      g2d.fillRect(offset+p.x*squareSize, offset+p.y*squareSize, squareSize, squareSize);
    }
  }
 
  private void tick() throws InterruptedException {
    repaint();
    
    Thread.sleep(100);
  }  
  private void changeAll(int x, int y){
    for(int i = 0; i < players.size(); i++){
      Point p = players.get(i);
      try{
        int val = currentMap[p.y+y][p.x+x];
        if(val == 0 || val == 7){
          p.x += x;
          p.y += y;
        }
        else if(val == 2){
          players.remove(p);
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
    frame.setSize(squareSize*27+offset, 400);
    frame.setVisible(true);
    frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
    while (true)
    {
      game.tick();
    }
  }
 
 
}